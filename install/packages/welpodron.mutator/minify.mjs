import path from 'path';
import fs from 'fs/promises';
import UglifyJS from 'uglify-js';

(async () => {
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

  await walk(path.resolve(`./iife`), '.js');

  /**
   * @param {string} file
   * @returns Promise<void>
   */
  const minifyJSFile = async (file) => {
    // Получить директорую файла
    const dir = path.dirname(file);
    // Получить имя файла без расширения
    const fileName = path.basename(file, '.js');

    let content = await fs.readFile(file, 'utf8');

    //! TODO: Refactor this if stable
    // REPLACE TEST START
    // ROLLUP
    content = content.replace(/this.window = this.window \|\| {};/g, '');
    // ES6 MODULES REPLACE
    //! WARNING ORDER IS IMPORTANT

    //! FORMS API
    content = content.replace(/responseContainer/g, 'resCont');
    content = content.replace(/captchaLoaded/g, 'capL');
    content = content.replace(/captchaKey/g, 'capK');
    content = content.replace(/isDisabled/g, 'isD');

    content = content.replace(/ATTRIBUTE_ACTION_FLUSH/g, 'A_A_F');
    content = content.replace(/ATTRIBUTE_ACTION_ARGS/g, 'A_A_A');
    content = content.replace(/ATTRIBUTE_ACTION/g, 'A_A');

    content = content.replace(/ATTRIBUTE_CONTENT/g, 'A_CON');

    content = content.replace(
      /ATTRIBUTE_ITEM_TRANSLATING_FROM_LEFT/g,
      'A_I_T_F_L'
    );
    content = content.replace(
      /ATTRIBUTE_ITEM_TRANSLATING_TO_LEFT/g,
      'A_I_T_T_L'
    );
    content = content.replace(
      /ATTRIBUTE_ITEM_TRANSLATING_FROM_RIGHT/g,
      'A_I_T_F_R'
    );
    content = content.replace(
      /ATTRIBUTE_ITEM_TRANSLATING_TO_RIGHT/g,
      'A_I_T_T_R'
    );
    content = content.replace(/ATTRIBUTE_ITEM_ACTIVE/g, 'A_I_A');
    content = content.replace(/ATTRIBUTE_ITEM_ID/g, 'A_I_I');
    content = content.replace(/ATTRIBUTE_ITEM/g, 'A_I');

    content = content.replace(/ATTRIBUTE_CONTROL_ACTIVE/g, 'A_C_A');
    content = content.replace(/ATTRIBUTE_CONTROL/g, 'A_C');

    content = content.replace(/ATTRIBUTE_BASE_ACTIVE/g, 'A_B_A');
    content = content.replace(/ATTRIBUTE_BASE_ONCE/g, 'A_B_O');
    content = content.replace(/ATTRIBUTE_BASE_ID/g, 'A_B_I');
    content = content.replace(/ATTRIBUTE_BASE/g, 'A_B');
    content = content.replace(/MODULE_BASE/g, 'M_B');

    content = content.replace(/DEFAULT_EVENT_CLICK/g, 'D_E_C');
    content = content.replace(/DEFAULT_EVENT_KEYDOWN/g, 'D_E_KD');
    content = content.replace(/DEFAULT_EVENT_TOUCHSTART/g, 'D_E_TS');
    content = content.replace(/DEFAULT_EVENT_TOUCHMOVE/g, 'D_E_TM');
    content = content.replace(/DEFAULT_EVENT_TOUCHEND/g, 'D_E_TE');

    // GENERIC
    content = content.replace(/supportedActions/g, 'spAc');
    content = content.replace(/\banimation\b/g, 'an');
    // HANDLERS
    content = content.replace(/handleDocumentKeyDown/g, 'hDKD');
    content = content.replace(/handleDocumentClick/g, 'hDC');
    content = content.replace(/handleElementTouchMove/g, 'hETM');
    content = content.replace(/handleElementTouchEnd/g, 'hETE');
    content = content.replace(/handleElementTouchStart/g, 'hETS');
    // STATE
    content = content.replace(/isTranslating/g, 'isTr');
    content = content.replace(/isActive/g, 'isAc');
    // MODAL
    content = content.replace(/firstFocusableElement/g, 'fFE');
    content = content.replace(/lastFocusedElement/g, 'lFdE');
    content = content.replace(/lastFocusableElement/g, 'lFeE');
    // CAROUSEL
    content = content.replace(/touchStartX/g, 'tSX');
    content = content.replace(/touchDeltaX/g, 'tDX');
    content = content.replace(/swipeThreshold/g, 'sTh');
    content = content.replace(/currentItemIndex/g, 'cItIn');
    content = content.replace(/nextItemIndex/g, 'nItIn');
    content = content.replace(/getNextItem/g, 'gNIt');
    content = content.replace(/getNextDirection/g, 'gNDi');
    content = content.replace(/clearAttributes/g, 'cA');
    // REPLACE TEST END

    const sourceMapOptions = {
      filename: `${fileName}.min.js`,
      url: `${fileName}.min.js.map`,
    };

    try {
      const tsSourceMap = await fs.readFile(
        path.join(dir, `${fileName}.js.map`),
        'utf8'
      );

      if (tsSourceMap) {
        sourceMapOptions.content = tsSourceMap;
      }
    } catch (error) {}

    const minifyOptions = {
      warnings: false,
      sourceMap: sourceMapOptions,
    };

    if (file.includes('iife')) {
      //! Атрибуты идут в виде: ЧТО_ПОМЕНЯТЬ_1,ЧТО_ПОМЕНЯТЬ_2:НА_ЧТО_ПОМЕНЯТЬ_1,НА_ЧТО_ПОМЕНЯТЬ_2
      // minifyOptions.enclose = 'window,document:window,document';
      if (content.includes('document')) {
        minifyOptions.enclose = 'document:document';
      }
    }

    const result = UglifyJS.minify(
      {
        [`${fileName}.js`]: content,
      },
      minifyOptions
    );

    if (result.error) {
      console.log(result.error);
      return;
    }

    if (result.warnings) {
      console.log({
        file,
        warnings: result.warnings,
      });
    }

    // Сохранить минифицированный файл
    await fs.writeFile(
      path.join(dir, `${fileName}.min.js`),
      result.code,
      'utf8'
    );

    // Сохранить source map
    await fs.writeFile(
      path.join(dir, `${fileName}.min.js.map`),
      result.map,
      'utf8'
    );
  };

  /** @type {Promise<void>[]} */
  let promises = [];

  for (let file of files) {
    promises.push(minifyJSFile(file));
  }

  await Promise.all(promises);
})();
