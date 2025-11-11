{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
    pkgs.nodePackages.http-server # Use a standard static web server
    pkgs.firebase-tools
  ];
  env = {
    FIREBASE_CONFIG = '''
      {
        apiKey: "AIzaSyBCdE4gHtnQYOX6Dht99CR5tTYMtwWNBSg",
        authDomain: "myown-36648480-fbedd.firebaseapp.com",
        projectId: "myown-36648480-fbedd",
        storageBucket: "myown-36648480-fbedd.firebasestorage.app",
        messagingSenderId: "497878218081",
        appId: "1:497878218081:web:eaa861fb10dae0fa62c120"
      }
    ''';
  };
  idx = {
    extensions = [
      "google.gemini-cli-vscode-ide-companion"
    ];
    previews = {
      enable = true;
      previews = {
        web = {
          # Serve the root directory using http-server on the correct port
          command = ["npx" "http-server" "-p" "$PORT"];
          manager = "web";
        };
      };
    };
    # openFiles tells the workspace which files to open automatically on startup.
    openFiles = [ ".idx/dev.nix" "index.html" ];
  };
}