<?
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) {
    die();
}

use Bitrix\Main\Config\Option;
use Bitrix\Main\Loader;
use Bitrix\Main\Context;

use Welpodron\Core\Helper;

$moduleId = 'welpodron.mutator';

$arTabs = [
    [
        'DIV' => 'edit1',
        'TAB' => 'Основные настройки',
        'TITLE' => 'Основные настройки',
        'GROUPS' => [
            [
                'TITLE' => 'Настройки безопасности',
                'OPTIONS' => [
                    [
                        'NAME' => 'USE_RESTRICTIONS_DIRECTORY',
                        'LABEL' => 'Использовать только разрешенную для подключения директорию',
                        'VALUE' => Option::get($moduleId, 'USE_RESTRICTIONS_DIRECTORY'),
                        'TYPE' => 'checkbox',
                    ],
                    [

                        'NAME' => 'RESTRICTIONS_DIRECTORY',
                        'LABEL' => 'Разрешенная для подключения директория',
                        'VALUE' => Option::get($moduleId, 'RESTRICTIONS_DIRECTORY'),
                        'RELATION' => 'USE_RESTRICTIONS_DIRECTORY',
                        'TYPE' => 'file',
                    ],
                ],
            ]
        ]
    ],
];

if (Loader::includeModule('welpodron.core')) {
    Helper::buildOptions($moduleId, $arTabs);
} else {
    echo 'Модуль welpodron.core не установлен';
}
