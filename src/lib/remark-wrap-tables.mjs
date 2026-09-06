import { visit } from "unist-util-visit";

export function remarkWrapTables() {
  return (tree) => {
    visit(tree, "table", (node, index, parent) => {
      if (!parent || index == null) return;
      const wrapper = {
        type: "html",
        value: '<div class="table-wrapper">',
      };
      const closer = {
        type: "html",
        value: "</div>",
      };
      parent.children.splice(index, 1, wrapper, node, closer);
      return index + 3;
    });
  };
}
