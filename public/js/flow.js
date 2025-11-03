
import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

async function main() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');
    const canvasContainer = document.getElementById('flow-canvas-container');
    const svg = document.getElementById('flow-canvas');
    const contextMenu = document.getElementById('context-menu');
    const signOutBtn = document.getElementById('sign-out-btn');
    const userInfo = document.getElementById('user-info');

    const inputModal = document.getElementById('input-modal');
    const inputForm = document.getElementById('input-form');
    const closeInputModalBtn = document.getElementById('close-input-modal-btn');
    const inputModalTitle = document.getElementById('input-modal-title');
    const inputModalLabel = document.getElementById('input-modal-label');
    const inputModalField = document.getElementById('input-modal-field');

    const editorModal = document.getElementById('editor-modal');
    const editorForm = document.getElementById('editor-form');
    const closeEditorModalBtn = document.getElementById('close-editor-modal-btn');

    let app, auth, db, userId;
    let nodes = [], arrows = [];
    let onInputConfirm = null;
    let draggingNode = null;
    let drawingArrow = null;

    if (!firebaseConfig) {
        document.body.innerHTML = `<div class="text-red-500 p-8">Error: Firebase config not found.</div>`;
        return;
    }
    
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    signOutBtn.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Sign out error", error));
    });

    onAuthStateChanged(auth, user => {
        if (user && !user.isAnonymous) {
            userId = user.uid;
            userInfo.textContent = `Signed in as ${user.email}`;
            mainContent.classList.remove('hidden');
            loadingOverlay.classList.add('hidden');

            onSnapshot(collection(db, `users/${userId}/flow_nodes`), s => { nodes = s.docs.map(d => ({ ...d.data(), id: d.id })); render(); });
            onSnapshot(collection(db, `users/${userId}/flow_arrows`), s => { arrows = s.docs.map(d => ({ ...d.data(), id: d.id })); render(); });
            
            autoAnimate(canvasContainer);
            setupCoreEventListeners();
        } else {
            window.location.href = 'login.html';
        }
    });
    
    const openInputModal = (title, label, initialValue = '', callback) => {
        inputModalTitle.innerText = title;
        inputModalLabel.innerText = label;
        inputModalField.value = initialValue;
        onInputConfirm = callback;
        inputModal.classList.remove('hidden');
        inputModalField.focus();
    };

    const setupCoreEventListeners = () => {
        canvasContainer.addEventListener('mousedown', e => {
            if (e.target.closest('.node')) return;
            if (drawingArrow) {
                drawingArrow = null;
                canvasContainer.style.cursor = 'default';
                document.getElementById('main-content').style.cursor = 'default';
            }
        });

        document.addEventListener('mousemove', e => {
            if (!draggingNode) return;
            const newX = e.clientX - draggingNode.offsetX;
            const newY = e.clientY - draggingNode.offsetY;
            draggingNode.element.style.left = `${newX}px`;
            draggingNode.element.style.top = `${newY}px`;
            drawArrows();
        });

        document.addEventListener('mouseup', e => {
            if (draggingNode) {
                draggingNode.element.style.cursor = 'grab';
                const node = nodes.find(n => n.id === draggingNode.id);
                if (node) {
                    const newX = parseFloat(draggingNode.element.style.left);
                    const newY = parseFloat(draggingNode.element.style.top);
                    if (node.x !== newX || node.y !== newY) {
                         updateDoc(doc(db, `users/${userId}/flow_nodes`, draggingNode.id), { x: newX, y: newY });
                    }
                }
                draggingNode = null;
            }
        });

        document.addEventListener('contextmenu', e => {
            e.preventDefault();
            const nodeEl = e.target.closest('.node');
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.display = 'block';

            const containerRect = canvasContainer.getBoundingClientRect();
            const x = e.clientX - containerRect.left;
            const y = e.clientY - containerRect.top;

            if (nodeEl) {
                const nodeId = nodeEl.dataset.id;
                contextMenu.innerHTML = `
                    <div data-action="add-arrow" data-id="${nodeId}">Add Arrow</div>
                    <div data-action="edit-node" data-id="${nodeId}">Edit Node</div>
                    <div data-action="delete-node" data-id="${nodeId}">Delete Node</div>
                `;
            } else {
                contextMenu.innerHTML = `
                    <div data-action="add-node" data-shape="rectangle" data-x="${x}" data-y="${y}">Add Rectangle Node</div>
                    <div data-action="add-node" data-shape="circle" data-x="${x}" data-y="${y}">Add Circle Node</div>
                    <div data-action="add-node" data-shape="diamond" data-x="${x}" data-y="${y}">Add Diamond Node</div>
                `;
            }
        });

        document.addEventListener('click', e => {
            if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
        });

        contextMenu.onclick = e => {
            const { action, shape, x, y, id } = e.target.dataset;
            contextMenu.style.display = 'none';

            if (action === 'add-node') {
                openInputModal(`New ${shape} Node`, 'Node Title', '', title => {
                    addDoc(collection(db, `users/${userId}/flow_nodes`), { title, shape, x: parseInt(x, 10), y: parseInt(y, 10), description: '' });
                });
            } else if (action === 'delete-node') {
                if (!confirm('Are you sure?')) return;
                const batch = writeBatch(db);
                batch.delete(doc(db, `users/${userId}/flow_nodes`, id));
                arrows.filter(a => a.from === id || a.to === id).forEach(a => batch.delete(doc(db, `users/${userId}/flow_arrows`, a.id)));
                batch.commit();
            } else if (action === 'add-arrow') {
                drawingArrow = { from: id };
                document.getElementById('main-content').style.cursor = 'crosshair';
            } else if (action === 'edit-node') {
                const node = nodes.find(n => n.id === id);
                if(node) openEditorModal(node);
            }
        };
    }

    const closeInputModal = () => {
        inputModal.classList.add('hidden');
        onInputConfirm = null;
        inputForm.reset();
    }

    const openEditorModal = (node) => {
        editorModal.classList.remove('hidden');
        editorForm['editor-node-id'].value = node.id;
        editorForm['editor-node-title'].value = node.title;
        editorForm['editor-node-description'].value = node.description || '';
    };

    const closeEditorModal = () => editorModal.classList.add('hidden');

     const render = () => {
        canvasContainer.querySelectorAll('.node').forEach(n => n.remove());
        nodes.forEach(node => {
            const nodeEl = document.createElement('div');
            nodeEl.dataset.id = node.id;
            nodeEl.className = `node ${node.shape}`;
            nodeEl.style.left = `${node.x}px`;
            nodeEl.style.top = `${node.y}px`;
            nodeEl.innerHTML = `<div class="node-title">${node.title}</div>`;
            canvasContainer.appendChild(nodeEl);

            nodeEl.onmousedown = e => {
                if (e.button !== 0) return;
                if (drawingArrow) {
                    const toId = node.id;
                    if (drawingArrow.from !== toId) {
                        addDoc(collection(db, `users/${userId}/flow_arrows`), { from: drawingArrow.from, to: toId });
                    }
                    drawingArrow = null;
                    document.getElementById('main-content').style.cursor = 'default';
                    e.stopPropagation();
                    return;
                }
                draggingNode = {
                    id: node.id,
                    element: nodeEl,
                    offsetX: e.clientX - node.x,
                    offsetY: e.clientY - node.y
                };
                nodeEl.style.cursor = 'grabbing';
            };

            nodeEl.ondblclick = () => openEditorModal(node);
        });
        drawArrows();
    };

    const drawArrows = () => {
        svg.innerHTML = '';
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.id = 'arrowhead';
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        marker.innerHTML = '<path d="M 0 0 L 10 5 L 0 10 z" fill="#4e6e8e"></path>';
        defs.appendChild(marker);
        svg.appendChild(defs);

        arrows.forEach(arrow => {
            const fromNode = nodes.find(n => n.id === arrow.from);
            const toNode = nodes.find(n => n.id === arrow.to);
            if (!fromNode || !toNode) return;
            
            const fromEl = document.querySelector(`[data-id='${fromNode.id}']`);
            const toEl = document.querySelector(`[data-id='${toNode.id}']`);
            if (!fromEl || !toEl) return;

            const startX = fromEl.offsetLeft + fromEl.offsetWidth / 2;
            const startY = fromEl.offsetTop + fromEl.offsetHeight / 2;
            const endX = toEl.offsetLeft + toEl.offsetWidth / 2;
            const endY = toEl.offsetTop + toEl.offsetHeight / 2;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', startX);
            line.setAttribute('y1', startY);
            line.setAttribute('x2', endX);
            line.setAttribute('y2', endY);
            line.setAttribute('stroke', '#4e6e8e');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('marker-end', 'url(#arrowhead)');
            svg.appendChild(line);
        });
    };

    closeInputModalBtn.onclick = closeInputModal;
    inputForm.onsubmit = e => {
        e.preventDefault();
        const value = inputModalField.value.trim();
        if (value && onInputConfirm) onInputConfirm(value);
        closeInputModal();
    };

    closeEditorModalBtn.onclick = closeEditorModal;
    editorForm.onsubmit = e => {
        e.preventDefault();
        const nodeId = editorForm['editor-node-id'].value;
        const title = editorForm['editor-node-title'].value.trim();
        const description = editorForm['editor-node-description'].value.trim();
        if(nodeId && title) {
            updateDoc(doc(db, `users/${userId}/flow_nodes`, nodeId), { title, description });
        }
        closeEditorModal();
    };
}

main();
