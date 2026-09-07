#!/usr/bin/env bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

STRUCTURIZR_DIR="/tmp/ytr-structurizr"

rm -rf "$STRUCTURIZR_DIR"

mkdir -p \
  "$STRUCTURIZR_DIR/01-row-reorder" \
  "$STRUCTURIZR_DIR/02-column-reorder"

cp "$REPO_ROOT/docs/architecture/row-reorder-v1-architecture.dsl" \
  "$STRUCTURIZR_DIR/01-row-reorder/workspace.dsl"

cp "$REPO_ROOT/docs/architecture/column-reorder-v1-architecture.dsl" \
  "$STRUCTURIZR_DIR/02-column-reorder/workspace.dsl"

chmod -R u+rwX "$STRUCTURIZR_DIR"

docker run -it --rm \
  -p 8888:8080 \
  -u 0:0 \
  -e STRUCTURIZR_WORKSPACES='*' \
  -v "$STRUCTURIZR_DIR:/usr/local/structurizr" \
  structurizr/structurizr local
