#!/usr/bin/env zsh

SCRIPT_DIR="${0:A:h}"

cat >> ~/.zshrc << EOF
alias pnpm='function _pnpm(){ 
  if [[ "\$1" == "install" ]]; then 
    shift
    ${SCRIPT_DIR}/pnpm-install-override.sh "\$@"
  else 
    command pnpm "\$@"
  fi
}; _pnpm'
EOF

pnpm add -g js-yaml@4.1.1

