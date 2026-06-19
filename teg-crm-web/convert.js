import fs from 'fs';
import path from 'path';

function walkSync(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walkSync(filepath, callback);
    } else if (stats.isFile()) {
      callback(filepath);
    }
  });
}

function processFile(filepath) {
  if (!filepath.endsWith('.tsx') && !filepath.endsWith('.ts')) return;

  let content = fs.readFileSync(filepath, 'utf-8');

  // Remove "use client";
  content = content.replace(/"use client";\n?/g, '');

  // Imports
  content = content.replace(/import \{.*?\} from "next\/navigation";/g, (match) => {
    let newImports = [];
    if (match.includes('useRouter')) newImports.push('useNavigate');
    if (match.includes('useSearchParams')) newImports.push('useSearchParams');
    if (match.includes('useParams')) newImports.push('useParams');
    return `import { ${newImports.join(', ')} } from "react-router-dom";`;
  });
  content = content.replace(/import Link from "next\/link";/g, 'import { Link } from "react-router-dom";');
  
  // Link href to
  content = content.replace(/<Link\s+href=/g, '<Link to=');

  // useRouter -> useNavigate
  content = content.replace(/const router = useRouter\(\);/g, 'const navigate = useNavigate();');
  content = content.replace(/router\.push\(/g, 'navigate(');
  content = content.replace(/router\.replace\(/g, 'navigate(');

  fs.writeFileSync(filepath, content);

  // Rename page.tsx to index.tsx
  if (path.basename(filepath) === 'page.tsx') {
    const newPath = path.join(path.dirname(filepath), 'index.tsx');
    fs.renameSync(filepath, newPath);
  }
}

const targetDir = path.join(process.cwd(), 'src/app');
if (fs.existsSync(targetDir)) {
  walkSync(targetDir, processFile);
}
console.log('Conversion complete.');
