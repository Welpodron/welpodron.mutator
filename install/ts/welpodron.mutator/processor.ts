(async () => {
  const cssList: string[] = [];
  const jsList: string[] = [];
  const stringList: string[] = [];

  type AssetType = {
    url: string;
    ext: string;
    loaded: boolean;
  };

  const getExtension = (str: string) => {
    const items = str.split("?")[0].split(".");
    return items[items.length - 1].toLowerCase();
  };

  const getUrl = (url: string) => {
    let _url = url.replace(/^(http[s]*:)*\/\/[^\/]+/i, "");
    _url = _url.replace(/\?[0-9]*$/, "");

    let minPos = _url.indexOf(".min");

    return minPos >= 0
      ? _url.substr(0, minPos) + _url.substr(minPos + 4)
      : _url;
  };

  const isCSSFileLoaded = (fileSrc: string) => {
    const url = getUrl(fileSrc);

    // TODO! Тут нужно уменьшить количество циклов, нужен такой css селектор, который сразу выбирает все теги link c не пустым href
    const links = document.getElementsByTagName("link");

    if (links.length > 0) {
      for (let i = 0; i < links.length; i++) {
        const href = links[i].getAttribute("href");

        if (href && href.trim().length > 0) {
          if (getUrl(href) === url) {
            return true;
          }
        }
      }
    }

    return false;
  };

  const isScriptFileLoaded = (fileSrc: string) => {
    const url = getUrl(fileSrc);

    // TODO! Тут нужно уменьшить количество циклов, нужен такой css селектор, который сразу выбирает все теги script с не пустым src
    const scripts = document.getElementsByTagName("script");

    if (scripts.length > 0) {
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute("src");

        if (src && src.trim().length > 0) {
          if (getUrl(src) === url) {
            return true;
          }
        }
      }
    }

    return false;
  };

  const deferred = <T = unknown>(): Promise<T> & {
    resolve: (value?: T | PromiseLike<T>) => void;
  } => {
    let resolver, promise;
    promise = new Promise<T>((resolve, reject) => {
      resolver = resolve;
    });
    (
      promise as Promise<T> & { resolve: (value: T | PromiseLike<T>) => void }
    ).resolve = resolver as unknown as (value: T | PromiseLike<T>) => void;
    return promise as Promise<T> & {
      resolve: (value?: T | PromiseLike<T>) => void;
    };
  };

  const loadAsset = async ({ url, ext }: AssetType) => {
    const promise = deferred();

    let element: HTMLScriptElement | HTMLLinkElement | null = null;

    if (ext === "css") {
      element = document.createElement("link");
      element.rel = "stylesheet";
      element.href = url;
    } else {
      if (ext === "js") {
        element = document.createElement("script");
        element.src = url;
        element.defer = false;
        element.async = false;
      }
    }

    if (element) {
      document.head.insertBefore(element, document.head.lastChild);

      element.onload = () => {
        promise.resolve();
      };

      element.onerror = () => {
        promise.resolve();
      };
    } else {
      promise.resolve();
    }

    return promise;
  };

  const loadAssets = async (urls: string[]) => {
    if (!Array.isArray(urls) || urls.length === 0) {
      return;
    }

    const promises: Promise<unknown>[] = [];

    for (let url of urls) {
      const asset: AssetType = {
        url,
        ext: getExtension(url),
        loaded: false,
      };

      if (asset.ext === "css") {
        if (isCSSFileLoaded(asset.url)) {
          asset.loaded = true;
        }
      } else {
        if (asset.ext === "js") {
          if (isScriptFileLoaded(asset.url)) {
            asset.loaded = true;
          }
        } else {
          asset.loaded = true;
        }
      }

      if (!asset.loaded) {
        promises.push(loadAsset(asset));
      }
    }

    return Promise.allSettled(promises);
  };

  const _parseHTML = (data: string, scriptsRunFirst = false) => {
    const regulars = {
      script: /<script([^>]*)>/gi,
      script_end: /<\/script>/gi,
      script_src: /src=["\']([^"\']+)["\']/i,
      script_type: /type=["\']([^"\']+)["\']/i,
      style: /<link.*?(rel="stylesheet"|type="text\/css")[^>]*>/i,
      style_href: /href=["\']([^"\']+)["\']/i,
    };

    let matchScript: RegExpExecArray | null,
      matchStyle: RegExpMatchArray | null,
      matchSrc: RegExpMatchArray | null,
      matchHref: RegExpMatchArray | null,
      matchType: RegExpMatchArray | null,
      scripts: {
        bRunFirst: boolean;
        isInternal: boolean;
        JS: string;
      }[] = [],
      styles: string[] = [];
    let textIndexes: number[][] = [];
    let lastIndex =
      (regulars.script.lastIndex =
      regulars.script_end.lastIndex =
        0);

    // Парсинг скриптов
    while ((matchScript = regulars.script.exec(data)) !== null) {
      regulars.script_end.lastIndex = regulars.script.lastIndex;

      let matchScriptEnd = regulars.script_end.exec(data);
      if (matchScriptEnd === null) {
        break;
      }

      // skip script tags of special types
      let skipTag = false;
      if ((matchType = matchScript[1].match(regulars.script_type)) !== null) {
        if (
          matchType[1] == "text/html" ||
          matchType[1] == "text/template" ||
          matchType[1] == "extension/settings"
        ) {
          skipTag = true;
        }
      }

      if (skipTag) {
        textIndexes.push([
          lastIndex,
          regulars.script_end.lastIndex - lastIndex,
        ]);
      } else {
        textIndexes.push([lastIndex, matchScript.index - lastIndex]);

        let bRunFirst =
          scriptsRunFirst || matchScript[1].indexOf("bxrunfirst") !== -1;

        if ((matchSrc = matchScript[1].match(regulars.script_src)) !== null) {
          scripts.push({
            bRunFirst: bRunFirst,
            isInternal: false,
            JS: matchSrc[1],
          });
        } else {
          let start = matchScript.index + matchScript[0].length;
          let js = data.substr(start, matchScriptEnd.index - start);

          scripts.push({ bRunFirst: bRunFirst, isInternal: true, JS: js });
        }
      }

      lastIndex = matchScriptEnd.index + 9;
      regulars.script.lastIndex = lastIndex;
    }

    textIndexes.push([
      lastIndex,
      lastIndex === 0 ? data.length : data.length - lastIndex,
    ]);
    let pureData = "";
    for (let i = 0, length = textIndexes.length; i < length; i++) {
      if (data && data.substr) {
        pureData += data.substr(textIndexes[i][0], textIndexes[i][1]);
      }
    }

    // Парсинг стилей
    while ((matchStyle = pureData.match(regulars.style)) !== null) {
      if (
        (matchHref = matchStyle[0].match(regulars.style_href)) !== null &&
        matchStyle[0].indexOf('media="') < 0
      ) {
        styles.push(matchHref[1]);
      }

      pureData = pureData.replace(matchStyle[0], "");
    }

    return { HTML: pureData, SCRIPT: scripts, STYLE: styles };
  };

  //! TODO: А что если уже запущена мутация? Я думаю, стоит проверять наличие переменной window.mutating
  //! по поводу реализации написано внутри контроллера
  (window as any).mutating = deferred();

  if (Array.isArray(cssList) && cssList.length > 0) {
    await loadAssets(cssList);
  }

  if (Array.isArray(jsList) && jsList.length > 0) {
    await loadAssets(jsList);
  }

  if (Array.isArray(stringList) && stringList.length > 0) {
    const parsedHtml = _parseHTML(stringList.join(""));

    const externalCss = parsedHtml.STYLE.reduce((acc, item) => {
      if (item && item !== "") {
        acc.push(item);
      }
      return acc;
    }, [] as string[]);

    const externalJs = parsedHtml.SCRIPT.reduce((acc, item) => {
      if (!item.isInternal) {
        acc.push(item.JS);
      }
      return acc;
    }, [] as string[]);

    const inlineJs = parsedHtml.SCRIPT.reduce((acc, item) => {
      if (item.isInternal) {
        acc.push(item.JS);
      }
      return acc;
    }, [] as string[]);

    if (parsedHtml.HTML.length) {
      document.head.insertAdjacentHTML("beforeend", parsedHtml.HTML);
    }

    await loadAssets(externalCss);
    await loadAssets(externalJs);

    inlineJs.forEach((data) => {
      if (data) {
        const script = document.createElement("script");

        script.type = "text/javascript";

        script.appendChild(document.createTextNode(data));

        document.head.insertBefore(script, document.head.firstChild);
        document.head.removeChild(script);
      }
    });
  }

  (window as any).mutating.resolve();
})();
