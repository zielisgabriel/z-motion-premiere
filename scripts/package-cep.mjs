import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
} from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const metadata = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const manifest = await readFile(resolve(root, "cep/manifest.xml"), "utf8");
if (!manifest.includes(`ExtensionBundleVersion="${metadata.version}"`))
  throw new Error("The manifest and package versions must match.");
for (const folder of ["CSXS", "host", "images", "licenses"])
  await mkdir(resolve(output, folder), { recursive: true });
await writeFile(resolve(output, "CSXS/manifest.xml"), manifest);
await writeFile(
  resolve(output, "host/z-motion-host.jsx"),
  (
    await Promise.all(
      ["json-codec.jsx", "premiere-host.jsx"].map((file) =>
        readFile(resolve(root, "host", file), "utf8"),
      ),
    )
  ).join("\n"),
);
await copyFile(
  resolve(root, "public/images/icon.png"),
  resolve(output, "images/icon.png"),
);
await copyFile(
  resolve(root, "public/fonts/OFL.txt"),
  resolve(output, "licenses/argentum-sans-ofl.txt"),
);
for (const name of ["react", "react-dom", "scheduler"]) {
  await copyFile(
    resolve(root, "node_modules", name, "LICENSE"),
    resolve(output, "licenses", `${name}-license.txt`),
  );
}
let html = await readFile(resolve(output, "index.html"), "utf8");
html = html.replace(/ type="module"/g, " defer").replace(/ crossorigin/g, "");
html = html.replace(
  "<head>",
  "<head>\n    <meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'\" />",
);
await writeFile(resolve(output, "index.html"), html);
const inventory = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error("Symbolic links cannot enter the extension package.");
    if (entry.isDirectory()) await visit(path);
    else if (entry.name !== "integrity.json")
      inventory.push({
        path: relative(output, path).replaceAll("\\", "/"),
        sha256: createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      });
  }
}
await visit(output);
await writeFile(
  resolve(output, "integrity.json"),
  JSON.stringify(
    {
      product: "Z Motion",
      id: "com.zielis.z-motion",
      version: metadata.version,
      files: inventory.sort((a, b) => a.path.localeCompare(b.path)),
    },
    null,
    2,
  ),
);
console.log(
  `Packaged Z Motion ${metadata.version}: ${inventory.length} verified files in dist.`,
);
