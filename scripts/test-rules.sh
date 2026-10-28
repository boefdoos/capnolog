#!/bin/sh
# Regeltests tegen de Firestore-emulator (P14). Vindt Java in ~/.capnolog-tools
# als er geen JAVA_HOME gezet is, en geeft de Firebase CLI een eigen
# instellingenmap: ~/.config is op Thomas' Mac van root, en dan eindigt de CLI
# met een fout, ook als alle tests slagen.
set -e
if [ -z "$JAVA_HOME" ]; then
  for home in "$HOME"/.capnolog-tools/*/Contents/Home; do
    [ -d "$home" ] && JAVA_HOME="$home"
  done
fi
if [ -n "$JAVA_HOME" ]; then
  export JAVA_HOME
  export PATH="$JAVA_HOME/bin:$PATH"
fi
export XDG_CONFIG_HOME="$(pwd)/.cache/config"
mkdir -p "$XDG_CONFIG_HOME"
exec firebase emulators:exec --only firestore --project demo-capnolog "node --test tests/rules/firestore.test.mjs"
