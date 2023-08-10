<?

namespace Welpodron\Mutator\Controller;

use Bitrix\Main\Engine\Controller;
use Bitrix\Main\Error;
use Bitrix\Main\Engine\CurrentUser;
use Bitrix\Main\Loader;
use Welpodron\Mutator\Utils;
use Bitrix\Main\Web\Json;

class Receiver extends Controller
{
    //! TODO: Добавить поддержку ленивых изображений на мутаторах
    //! TODO: Добавить поддержку кэширования 
    const DEFAULT_MODULE_ID = 'welpodron.mutator';

    protected function getDefaultPreFilters()
    {
        return [];
    }

    private function loadModules()
    {
        if (!Loader::includeModule(self::DEFAULT_MODULE_ID)) {
            throw new \Exception('Модуль ' . self::DEFAULT_MODULE_ID . ' не удалось подключить');
        }
    }

    // Вызов из BX.ajax.runAction - welpodron:mutator.Receiver.load
    public function loadAction()
    {
        try {
            $this->loadModules();

            $request = $this->getRequest();
            $arDataRaw = $request->getPostList()->toArray();

            if ($arDataRaw['sessid'] !== bitrix_sessid()) {
                throw new \Exception('Неверный идентификатор сессии');
            }

            $from  = $arDataRaw['from'];

            $arParams = [];

            if ($arDataRaw['args']) {
                $arParams['ARGS'] = JSON::decode($arDataRaw['args']);
            }

            if ($arDataRaw['argsSensitive']) {
                $arParams['ARGS_SENSITIVE'] = Utils::getMutationData($arDataRaw['argsSensitive']);
            }

            if ($arParams['ARGS_SENSITIVE']['PATH']) {
                $path = $arParams['ARGS_SENSITIVE']['PATH'];
            } else {
                throw new \Exception('Не указан путь к мутатору');
            }

            return Utils::getMutationContent($path, $arParams, $from);
        } catch (\Throwable $th) {
            if (CurrentUser::get()->isAdmin()) {
                $this->addError(new Error($th->getMessage(), $th->getCode()));
                return;
            }

            $this->addError(new Error('Ошибка при загрузке мутатора'));
            return;
        }
    }
}
