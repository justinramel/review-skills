def escape_markdown_text:
  gsub("\\\\"; "\\\\")
  | gsub("(?<syntax>[`*_{}\\[\\]()#+.!|>-])"; "\\\(.syntax)");

def apply_marks($text; $marks):
  ($marks // []) as $all_marks
  | (if any($all_marks[]; .type == "code") then $text else ($text | escape_markdown_text) end) as $initial
  | reduce $all_marks[] as $mark ($initial;
    if $mark.type == "link" and ($mark.attrs.href // "") != "" then
      "[" + . + "](" + $mark.attrs.href + ")"
    elif $mark.type == "strong" then
      "**" + . + "**"
    elif $mark.type == "em" then
      "*" + . + "*"
    elif $mark.type == "code" then
      "`" + . + "`"
    elif $mark.type == "strike" then
      "~~" + . + "~~"
    else
      .
    end
  );

def trim_block:
  gsub("\\n+$"; "");

def raw_node_text:
  . as $node
  | if $node == null then
      ""
    elif ($node | type) == "string" then
      $node
    elif $node.type == "text" then
      ($node.text // "")
    elif $node.type == "hardBreak" then
      "\n"
    else
      (($node.content // []) | map(raw_node_text) | join(""))
    end;

def backtick_fence($text):
  "`" * ([3, ($text | scan("`+") | length + 1)] | max);
def render_node:
  . as $node
  | if $node == null then
      ""
    elif ($node | type) == "string" then
      ($node | escape_markdown_text)
    elif $node.type == "text" then
      apply_marks($node.text // ""; $node.marks)
    elif $node.type == "hardBreak" then
      "\n"
    elif $node.type == "mention" then
      "@" + ($node.attrs.text // $node.attrs.displayName // $node.attrs.id // "mention")
    elif $node.type == "emoji" then
      ($node.attrs.text // $node.attrs.shortName // ":emoji:")
    elif $node.type == "status" then
      "[" + ($node.attrs.text // "status") + "]"
    elif $node.type == "date" then
      ($node.attrs.timestamp // "")
    elif ($node.type == "inlineCard" or $node.type == "blockCard") then
      ($node.attrs.url // "") as $url
      | if $url == "" then "" else "[" + $url + "](" + $url + ")" end
    elif $node.type == "media" then
      ($node.attrs.url // "") as $url
      | ($node.attrs.alt // $node.attrs.id // "attachment") as $label
      | if $url == "" then "[attachment: " + $label + "]" else "[" + $label + "](" + $url + ")" end
    elif $node.type == "paragraph" then
      (($node.content // []) | map(render_node) | join("")) + "\n\n"
    elif $node.type == "heading" then
      (("#" * ($node.attrs.level // 1)) + " " + (($node.content // []) | map(render_node) | join(""))) + "\n\n"
    elif $node.type == "blockquote" then
      (($node.content // []) | map(render_node) | join("") | trim_block | split("\n") | map("> " + .) | join("\n")) + "\n\n"
    elif $node.type == "codeBlock" then
      (($node.content // []) | map(raw_node_text) | join("") | trim_block) as $body
      | backtick_fence($body) as $fence
      | $fence + ($node.attrs.language // "") + "\n"
      + $body
      + "\n" + $fence + "\n\n"
    elif $node.type == "rule" then
      "---\n\n"
    elif $node.type == "bulletList" then
      (($node.content // []) | map(
        . as $item
        | (($item.content // []) | map(render_node) | join("") | trim_block | gsub("\\n"; "\n  "))
        | "- " + . + "\n"
      ) | join("")) + "\n"
    elif $node.type == "orderedList" then
      (($node.content // []) | to_entries | map(
        . as $entry
        | ((($entry.key + ($node.attrs.order // 1)) | tostring) + ". ") as $marker
        | (" " * ($marker | length)) as $indent
        | (($entry.value.content // []) | map(render_node) | join("") | trim_block | gsub("\\n"; "\n" + $indent)) as $body
        | $marker + $body + "\n"
      ) | join("")) + "\n"
    elif $node.type == "taskList" then
      (($node.content // []) | map(
        . as $item
        | (if (($item.attrs.state // "") | ascii_downcase) == "done" then "- [x] " else "- [ ] " end)
          + (($item.content // []) | map(render_node) | join("") | trim_block | gsub("\\n"; "\n  "))
          + "\n"
      ) | join("")) + "\n"
    elif $node.type == "table" then
      (($node.content // []) | map(
        (.content // []) | map(
          (.content // []) | map(render_node) | join("") | trim_block | gsub("\\n+"; " ") | gsub("\\|"; "\\|")
        )
      )) as $rows
      | if ($rows | length) == 0 then
          ""
        else
          "| " + ($rows[0] | join(" | ")) + " |\n"
          + "| " + ($rows[0] | map("---") | join(" | ")) + " |\n"
          + (($rows[1:] | map("| " + (join(" | ")) + " |") | join("\n")))
          + "\n\n"
        end
    elif ($node.type == "expand" or $node.type == "nestedExpand") then
      "### " + ($node.attrs.title // "Details") + "\n\n"
      + (($node.content // []) | map(render_node) | join(""))
    else
      (($node.content // []) | map(render_node) | join(""))
    end;

def render_value:
  . as $value
  | if $value == null then
      "(none)"
    elif ($value | type) == "string" then
      if $value == "" then "(none)" else $value end
    elif ($value | type) == "array" then
      if ($value | length) == 0 then "(none)" else ($value | map(render_value) | join("\n")) end
    elif ($value | type) == "object" and ($value.type? != null) then
      ($value | render_node | trim_block) as $rendered
      | if $rendered == "" then "(none)" else $rendered end
    elif ($value | type) == "object" then
      ($value.value // $value.name // ($value | tojson))
    else
      ($value | tostring)
    end;

. as $issue
| ($field_catalog[0] // []) as $catalog
| ($catalog | map(select((.name // "" | ascii_downcase | contains("acceptance criteria"))))) as $acceptance_fields
| ([
    "# " + $key + ": " + ($issue.fields.summary // "(no summary)"),
    "",
    "- Type: " + ($issue.fields.issuetype.name // "?"),
    "- Status: " + ($issue.fields.status.name // "?"),
    "- Priority: " + ($issue.fields.priority.name // "?"),
    "- Labels: " + (($issue.fields.labels // []) | join(", ")),
    "- Link: " + $base + "/browse/" + $key,
    "",
    "## Description",
    "",
    ($issue.fields.description | render_value),
    ""
  ]
  + if ($acceptance_fields | length) == 0 then
      [
        "## Acceptance Criteria",
        "",
        "(No dedicated Acceptance Criteria field was found.)",
        ""
      ]
    else
      ($acceptance_fields | map(
        . as $field
        | [
            "## " + $field.name,
            "",
            ($issue.fields[$field.id] | render_value),
            ""
          ]
      ) | add)
    end)
| .[]
