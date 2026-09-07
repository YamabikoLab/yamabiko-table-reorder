#!/usr/bin/env bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

STRUCTURIZR_DIR="/tmp/ytr-structurizr"
ROW_DIR="$STRUCTURIZR_DIR/01-row-reorder"
COLUMN_DIR="$STRUCTURIZR_DIR/02-column-reorder"

if [ ! -d "$STRUCTURIZR_DIR" ]; then
  mkdir "$STRUCTURIZR_DIR"
fi

if [ ! -d "$ROW_DIR" ]; then
  mkdir "$ROW_DIR"
fi

if [ ! -d "$COLUMN_DIR" ]; then
  mkdir "$COLUMN_DIR"
fi

cp "$REPO_ROOT/docs/architecture/row-reorder-v1-architecture.dsl" \
  "$ROW_DIR/workspace.dsl"

cp "$REPO_ROOT/docs/architecture/column-reorder-v1-architecture.dsl" \
  "$COLUMN_DIR/workspace.dsl"

chmod -R u+rwX "$STRUCTURIZR_DIR"

docker run -it --rm \
  -p 8888:8080 \
  -u 0:0 \
  -e STRUCTURIZR_WORKSPACES='*' \
  -v "$STRUCTURIZR_DIR:/usr/local/structurizr" \
  structurizr/structurizr local