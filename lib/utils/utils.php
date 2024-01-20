<?

namespace Welpodron\Mutator;

use Bitrix\Main\Page\Asset;
use Bitrix\Main\Page\AssetMode;
use Bitrix\Main\Config\Option;
use Welpodron\Mutator\Signer;

use CUtil;

class Utils
{
    const DEFAULT_MODULE_ID = 'welpodron.mutator';

    static public function getMutationContent($path = "", $arParams = [], $from = "")
    {
        if (empty($path)) {
            throw new \Exception('Не указан путь к файлу');
        }

        if (Option::get(self::DEFAULT_MODULE_ID, "USE_RESTRICTIONS_DIRECTORY") == "Y") {
            if (strpos($path, Option::get(self::DEFAULT_MODULE_ID, "RESTRICTIONS_DIRECTORY")) !== 0) {
                throw new \Exception('Путь к файлу не соответствует требованиям безопасности');
            }
        }

        global $APPLICATION;

        ob_start();
        $APPLICATION->IncludeFile($path, [
            'arMutation' => [
                'PATH' => $path,
                'PARAMS' => $arParams,
                'FROM' => $from,
            ]
        ], ["SHOW_BORDER" => false, "MODE" => "php"]);
        $templateIncludeResult = ob_get_contents();

        Asset::getInstance()->getCss();
        Asset::getInstance()->getJs();
        Asset::getInstance()->getStrings();

        $jsPathList = Asset::getInstance()->getTargetList('JS');
        $cssPathList = Asset::getInstance()->getTargetList('CSS');

        $jsList = [];
        foreach ($jsPathList as $targetAsset) {
            $assetInfo = Asset::getInstance()->getAssetInfo($targetAsset['NAME'], AssetMode::ALL);
            if (!empty($assetInfo['JS'])) {
                $jsList = array_merge($jsList, $assetInfo['JS']);
            }
        }

        $cssList = [];
        foreach ($cssPathList as $targetAsset) {
            $assetInfo = Asset::getInstance()->getAssetInfo($targetAsset['NAME'], AssetMode::ALL);
            if (!empty($assetInfo['CSS'])) {
                $cssList = array_merge($cssList, $assetInfo['CSS']);
            }
        }

        $stringList = [];
        foreach ($cssPathList as $targetAsset) {
            $assetInfo = Asset::getInstance()->getAssetInfo($targetAsset['NAME'], AssetMode::ALL);
            if (!empty($assetInfo['STRINGS'])) {
                $stringList = array_merge($stringList, $assetInfo['STRINGS']);
            }
        }

        foreach ($jsPathList as $targetAsset) {
            $assetInfo = Asset::getInstance()->getAssetInfo($targetAsset['NAME'], AssetMode::ALL);
            if (!empty($assetInfo['STRINGS'])) {
                $stringList = array_merge($stringList, $assetInfo['STRINGS']);
            }
        }

        //! Bitrix 2016 Support 
        try {
            $stringList[] = Asset::getInstance()->showFilesList();
        } catch (\Throwable $th) {
        }

        $cssList = CUtil::PhpToJSObject($cssList, false, true);
        $jsList = CUtil::PhpToJSObject($jsList, false, true);
        $stringList = CUtil::PhpToJSObject($stringList, false, true);

        $mutatorScript = <<<MUTATOR_SCRIPT
        <script>
        "use strict";
        (async () => {
            const cssList = {$cssList};
            const jsList = {$jsList};
            const stringList = {$stringList};
            const getExtension = (str) => {
                const items = str.split("?")[0].split(".");
                return items[items.length - 1].toLowerCase();
            };
            const getUrl = (url) => {
                let _url = url.replace(/^(http[s]*:)*\/\/[^\/]+/i, "");
                _url = _url.replace(/\?[0-9]*$/, "");
                let minPos = _url.indexOf(".min");
                return minPos >= 0
                    ? _url.substr(0, minPos) + _url.substr(minPos + 4)
                    : _url;
            };
            const isCSSFileLoaded = (fileSrc) => {
                const url = getUrl(fileSrc);
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
            const isScriptFileLoaded = (fileSrc) => {
                const url = getUrl(fileSrc);
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
            const deferred = () => {
                let resolver, promise;
                promise = new Promise((resolve, reject) => {
                    resolver = resolve;
                });
                promise.resolve = resolver;
                return promise;
            };
            const loadAsset = async ({ url, ext }) => {
                const promise = deferred();
                let element = null;
                if (ext === "css") {
                    element = document.createElement("link");
                    element.rel = "stylesheet";
                    element.href = url;
                }
                else {
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
                }
                else {
                    promise.resolve();
                }
                return promise;
            };
            const loadAssets = async (urls) => {
                if (!Array.isArray(urls) || urls.length === 0) {
                    return;
                }
                const promises = [];
                for (let url of urls) {
                    const asset = {
                        url,
                        ext: getExtension(url),
                        loaded: false,
                    };
                    if (asset.ext === "css") {
                        if (isCSSFileLoaded(asset.url)) {
                            asset.loaded = true;
                        }
                    }
                    else {
                        if (asset.ext === "js") {
                            if (isScriptFileLoaded(asset.url)) {
                                asset.loaded = true;
                            }
                        }
                        else {
                            asset.loaded = true;
                        }
                    }
                    if (!asset.loaded) {
                        promises.push(loadAsset(asset));
                    }
                }
                return Promise.allSettled(promises);
            };
            const _parseHTML = (data, scriptsRunFirst = false) => {
                const regulars = {
                    script: /<script([^>]*)>/gi,
                    script_end: /<\/script>/gi,
                    script_src: /src=["\']([^"\']+)["\']/i,
                    script_type: /type=["\']([^"\']+)["\']/i,
                    style: /<link.*?(rel="stylesheet"|type="text\/css")[^>]*>/i,
                    style_href: /href=["\']([^"\']+)["\']/i,
                };
                let matchScript, matchStyle, matchSrc, matchHref, matchType, scripts = [], styles = [];
                let textIndexes = [];
                let lastIndex = (regulars.script.lastIndex =
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
                        if (matchType[1] == "text/html" ||
                            matchType[1] == "text/template" ||
                            matchType[1] == "extension/settings") {
                            skipTag = true;
                        }
                    }
                    if (skipTag) {
                        textIndexes.push([
                            lastIndex,
                            regulars.script_end.lastIndex - lastIndex,
                        ]);
                    }
                    else {
                        textIndexes.push([lastIndex, matchScript.index - lastIndex]);
                        let bRunFirst = scriptsRunFirst || matchScript[1].indexOf("bxrunfirst") !== -1;
                        if ((matchSrc = matchScript[1].match(regulars.script_src)) !== null) {
                            scripts.push({
                                bRunFirst: bRunFirst,
                                isInternal: false,
                                JS: matchSrc[1],
                            });
                        }
                        else {
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
                    if ((matchHref = matchStyle[0].match(regulars.style_href)) !== null &&
                        matchStyle[0].indexOf('media="') < 0) {
                        styles.push(matchHref[1]);
                    }
                    pureData = pureData.replace(matchStyle[0], "");
                }
                return { HTML: pureData, SCRIPT: scripts, STYLE: styles };
            };
            window.mutating = deferred();
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
                }, []);
                const externalJs = parsedHtml.SCRIPT.reduce((acc, item) => {
                    if (!item.isInternal) {
                        acc.push(item.JS);
                    }
                    return acc;
                }, []);
                const inlineJs = parsedHtml.SCRIPT.reduce((acc, item) => {
                    if (item.isInternal) {
                        acc.push(item.JS);
                    }
                    return acc;
                }, []);
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
            window.mutating.resolve();
        })();
        </script>
MUTATOR_SCRIPT;

        $templateIncludeResult = $mutatorScript . $templateIncludeResult;

        ob_end_clean();

        return $templateIncludeResult;
    }

    static public function getMutationData($data = "")
    {
        $result = Signer::unsign($data);

        // Данные должны содержать идентификатор сессии битрикса 
        if (!$result['S']) {
            throw new \Exception('Неверный идентификатор сессии');
        }

        return $result;
    }
}
