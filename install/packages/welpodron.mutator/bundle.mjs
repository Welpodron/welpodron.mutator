import path from 'path';
import fs from 'fs/promises';

import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { nodeResolve } from '@rollup/plugin-node-resolve';

(async () => {
  /** @type {import('rollup').RollupBuild | undefined} */
  let bundle;

  try {
    await fs.rm(`./es`, {
      recursive: true,
      force: true,
    });

    await fs.rm(`./cjs`, {
      recursive: true,
      force: true,
    });

    await fs.rm(`./iife`, {
      recursive: true,
      force: true,
    });
  } catch (_) {}

  /** @type {import('rollup').RollupOptions} */
  let inputOptions = {
    input: `./ts/index.ts`,
    plugins: [
      nodeResolve({ extensions: ['.ts'] }),
      esbuild({
        sourceMap: true,
        target: 'esnext',
        exclude: ['./types', './es', './cjs', './iife'],
      }),
    ],
  };

  /** @type {import('rollup').OutputOptions[]} */
  const outputs = [
    {
      format: 'es',
      entryFileNames: '[name].js',
      dir: `./es`,
      preserveModules: true,
      sourcemap: true,
      entryFileNames: (chunkInfo) => {
        if (chunkInfo.name.includes('node_modules')) {
          return chunkInfo.name.replace('node_modules', 'external') + '.js';
        }

        return '[name].js';
      },
    },
    {
      format: 'cjs',
      entryFileNames: '[name].js',
      dir: `./cjs`,
      preserveModules: true,
      sourcemap: true,
      entryFileNames: (chunkInfo) => {
        if (chunkInfo.name.includes('node_modules')) {
          return chunkInfo.name.replace('node_modules', 'external') + '.js';
        }

        return '[name].js';
      },
    },
  ];

  try {
    bundle = await rollup(inputOptions);
    await Promise.all(outputs.map((output) => bundle.write(output)));
  } catch (error) {
    console.error(error);
  }

  if (bundle) {
    await bundle.close();
  }

  // IIFE BUILD

  /** @type {Set<string>} */
  let files = new Set();
  /**
   *
   * @param {string} dirPath
   * @param {string} ext
   * @returns Promise<void>
   */
  const walk = async (dirPath, ext) =>
    Promise.all(
      await fs.readdir(dirPath, { withFileTypes: true }).then((entries) =>
        entries.map((entry) => {
          const childPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            return walk(childPath, ext);
          }

          if (
            entry.isFile() &&
            entry.name.endsWith(ext) &&
            !entry.name.endsWith('.min' + ext)
          ) {
            const fileName = path.basename(childPath, ext);

            const parts = fileName.split('.');

            const last = parts.pop();

            if (last !== 'min') {
              files.add(childPath);
            }
          }
        })
      )
    );

  await walk(`./ts`, 'index.ts');

  for (let file of files) {
    const inputOptions = {
      input: file,
      plugins: [
        nodeResolve({ extensions: ['.ts'] }),
        esbuild({
          sourceMap: true,
          target: 'esnext',
          exclude: ['./types', './es', './cjs', './iife'],
        }),
      ],
      external: ['welpodron.core'],
    };
    try {
      bundle = await rollup(inputOptions);
      await bundle.write({
        format: 'iife',
        name: 'window.welpodron',
        extend: true,
        file: path.format({
          ...path.parse(file.replace(/ts/, 'iife')),
          base: '',
          ext: 'js',
        }),
        //! Велл, у битрикса куча рофлов про сорс мапы при объединении JS файлов и их сжатии, лучше просто отключить и создавать ток для минификации
        sourcemap: false,
        globals: { 'welpodron.core': 'window.welpodron' },
      });
    } catch (error) {
      console.error(error);
    }
    if (bundle) {
      await bundle.close();
    }
  }
})();
