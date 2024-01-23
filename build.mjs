import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import archiver from 'archiver';
import fg from 'fast-glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODULE_NAME = path.basename(__dirname);

const build = () => {
  const entries = fg.globSync(
    [
      '**',
      '.settings.php',
      '**/.parameters.php',
      '**/.description.php',
      '**/.tooltips.php',
      '**/.default/**',
    ],
    {
      ignore: [
        '**/node_modules/**',
        '**/tests/**',
        '**/cjs/**',
        '**/types/**',
        '**/iife/**/*.map',
        '**/*.json',
        '**/*.md',
        '**/*.mjs',
        '**/jest.*',
        '**/*.test.*',
        '**/LICENSE',
      ],
    }
  );

  if (!entries.length) {
    return console.error('Не найдены файлы для сборки');
  }

  try {
    fs.mkdirSync('.build');
  } catch (error) {
    if (error.code !== 'EEXIST') {
      return console.error(error);
    }
  }

  const output = fs.createWriteStream(
    path.resolve(`./.build/${MODULE_NAME}.zip`)
  );

  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  output.on('close', () => {
    console.log(
      `./.build/${MODULE_NAME}.zip` + ' : ' + archive.pointer() + ' байт'
    );
  });

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn(err);
    } else {
      throw err;
    }
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);

  entries.forEach((entry) => {
    archive.file(path.resolve(entry), {
      name: `${MODULE_NAME}/${entry}`,
    });
  });

  archive.finalize();
};

build();
