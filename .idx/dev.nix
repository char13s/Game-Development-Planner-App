{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
    pkgs.nodePackages.http-server # Use a standard static web server
    pkgs.firebase-tools
  ];
  env = {
    # This is not used by the client-side app, but keeping it is harmless
    FIREBASE_CONFIG = ''
      {
        apiKey: "AIzaSyBqCA96Xa2KZnFvCcFcBiM4kesb_1_H_tI",
        authDomain: "my-planner-v3.firebaseapp.com",
        projectId: "my-planner-v3",
        storageBucket: "my-planner-v3.firebasestorage.app",
  messagingSenderId: "1045901202322",
  appId: "1:1045901202322:web:08f00fc36e9916db00e74b"
      }
    '';
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
    workspace = {
      onCreate = {
        default.openFiles = [ ".idx/dev.nix" "index.html" ];
      };
    };
  };
}
