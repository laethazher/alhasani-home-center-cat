import re
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "prisma" / "schema.prisma"
text = path.read_text(encoding="utf-8")

text = re.sub(
    r"generator client \{[^}]+\}",
    'generator client {\n  provider        = "prisma-client-js"\n  previewFeatures = ["multiSchema"]\n}',
    text,
    count=1,
)
text = re.sub(
    r"datasource db \{[^}]+\}",
    'datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n  schemas   = ["km"]\n}',
    text,
    count=1,
)
text = text.replace("  MANAGER // مدير قسم\n", "")
text = text.replace("ADMIN // مدير النظام", "ADMIN // مدير نظام المنصّة")


def add_schema_to_blocks(content: str, keyword: str) -> str:
    lines = content.split("\n")
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith(keyword + " "):
            block = [line]
            depth = 0
            i += 1
            while i < len(lines):
                block.append(lines[i])
                depth += lines[i].count("{") - lines[i].count("}")
                if depth <= 0 and lines[i].strip() == "}":
                    if not any('@@schema("km")' in b for b in block):
                        block.insert(-1, '  @@schema("km")')
                    out.extend(block)
                    break
                i += 1
        else:
            out.append(line)
        i += 1
    return "\n".join(out)


text = add_schema_to_blocks(text, "enum")
text = add_schema_to_blocks(text, "model")
path.write_text(text, encoding="utf-8")
print("patched", path)
print("schema markers", text.count('@@schema("km")'))
