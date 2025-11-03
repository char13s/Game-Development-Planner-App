{ pkgs, ... }: {
  packages = [ pkgs.nodejs_20 ];

  idx.extensions = [
    "dbaeumer.vscode-eslint"
  ];

  idx.workspace.onStart = {
    install-deps = "npm install";
  };

  idx.previews = {
    enable = true;
    previews = {
      web = {
        command = ["npm" "run" "dev" "--" "--port" "$PORT"];
        manager = "web";
      };
    };
  };
}
