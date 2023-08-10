<?
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) {
    die();
}

use Bitrix\Main\Config\Option;
use Bitrix\Main\Loader;
use Bitrix\Main\Context;

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
                        'REL' => 'USE_RESTRICTIONS_DIRECTORY',
                        'TYPE' => 'file',
                    ],
                ],
            ]
        ]
    ],
];

$request = Context::getCurrent()->getRequest();

if ($request->isPost() && $request['save'] && check_bitrix_sessid()) {
    foreach ($arTabs as $arTab) {
        foreach ($arTab['GROUPS'] as $arGroup) {
            foreach ($arGroup['OPTIONS'] as $arOption) {
                if ($arOption['TYPE'] == 'note') continue;

                $value = $request->getPost($arOption['NAME']);

                if ($arOption['TYPE'] == "checkbox" && $value != "Y") {
                    $value = "N";
                } elseif (is_array($value)) {
                    $value = implode(",", $value);
                } elseif ($value === null) {
                    $value = '';
                }

                Option::set($moduleId, $arOption['NAME'], $value);
            }
        }
    }

    LocalRedirect($APPLICATION->GetCurPage() . '?lang=' . LANGUAGE_ID . '&mid_menu=1&mid=' . urlencode($moduleId) .
        '&tabControl_active_tab=' . urlencode($request['tabControl_active_tab']));
}

$tabControl = new CAdminTabControl("tabControl", $arTabs, true, true);
?>

<form name=<?= str_replace('.', '_', $moduleId) ?> method='post'>
    <? $tabControl->Begin(); ?>
    <?= bitrix_sessid_post(); ?>
    <? foreach ($arTabs as $arTab) : ?>
        <? $tabControl->BeginNextTab(); ?>
        <? foreach ($arTab['GROUPS'] as $arGroup) : ?>
            <tr class="heading">
                <td colspan="2"><?= $arGroup['TITLE'] ?></td>
            </tr>
            <? foreach ($arGroup['OPTIONS'] as $arOption) : ?>
                <tr>
                    <? if ($arOption['REL']) : ?>
                        <script>
                            (() => {
                                const init = () => {
                                    const relation = document.getElementById('<?= $arOption['REL'] ?>');

                                    if (!relation) {
                                        return;
                                    }

                                    const element = document.getElementById('<?= $arOption['NAME'] ?>');

                                    if (!element) {
                                        return;
                                    }

                                    const tr = element.closest('tr');

                                    const toggle = () => {
                                        if (relation.type === "checkbox" || relation.type === "radio") {
                                            if (relation.checked) {
                                                if (tr) {
                                                    tr.style.display = '';
                                                }

                                                element.removeAttribute('disabled');
                                            } else {
                                                if (tr) {
                                                    tr.style.display = 'none';
                                                }

                                                element.setAttribute('disabled', 'disabled');
                                            }

                                            return;
                                        }

                                        if (relation.value) {
                                            if (tr) {
                                                tr.style.display = '';
                                            }

                                            element.removeAttribute('disabled');
                                        } else {
                                            if (tr) {
                                                tr.style.display = 'none';
                                            }

                                            element.setAttribute('disabled', 'disabled');
                                        }
                                    }

                                    toggle();

                                    relation.addEventListener('input', toggle);
                                }

                                if (document.readyState === 'loading') {
                                    document.addEventListener('DOMContentLoaded', init, {
                                        once: true
                                    });
                                } else {
                                    init();
                                }
                            })();
                        </script>
                    <? endif ?>
                    <td style="width: 40%;">
                        <? if ($arOption['TYPE'] != 'note') : ?>
                            <label for="<?= $arOption['NAME'] ?>">
                                <?= $arOption['LABEL'] ?>
                            </label>
                        <? endif ?>
                    </td>
                    <td>
                        <? if ($arOption['TYPE'] == 'note') : ?>
                            <div class="adm-info-message">
                                <?= $arOption['LABEL'] ?>
                            </div>
                        <? elseif ($arOption['TYPE'] == 'checkbox') : ?>
                            <input <? if ($arOption['VALUE'] == "Y") echo "checked "; ?> type="checkbox" name="<?= htmlspecialcharsbx($arOption['NAME']) ?>" id="<?= htmlspecialcharsbx($arOption['NAME']) ?>" value="Y">
                        <? elseif ($arOption['TYPE'] == 'file') : ?>
                            <?
                            CAdminFileDialog::ShowScript(
                                array(
                                    "event" => str_replace('_', '', 'browsePath' . htmlspecialcharsbx($arOption['NAME'])),
                                    "arResultDest" => array("FORM_NAME" => str_replace('.', '_', $moduleId), "FORM_ELEMENT_NAME" => $arOption['NAME']),
                                    "arPath" => array("PATH" => GetDirPath($arOption['VALUE'])),
                                    "select" => 'D', // F - file only, D - folder only
                                    "operation" => 'O', // O - open, S - save
                                    "showUploadTab" => false,
                                    "showAddToMenuTab" => false,
                                    "allowAllFiles" => false,
                                    "SaveConfig" => true,
                                )
                            );
                            ?>
                            <input type="text" id="<?= htmlspecialcharsbx($arOption['NAME']) ?>" name="<?= htmlspecialcharsbx($arOption['NAME']) ?>" size="80" maxlength="255" value="<?= htmlspecialcharsbx($arOption['VALUE']); ?>">&nbsp;<input type="button" name="<?= ('browse' . htmlspecialcharsbx($arOption['NAME'])) ?>" value="..." onClick="<?= (str_replace('_', '', 'browsePath' . htmlspecialcharsbx($arOption['NAME']))) ?>()">
                        <? else : ?>
                            <input id="<?= htmlspecialcharsbx($arOption['NAME']) ?>" name="<?= htmlspecialcharsbx($arOption['NAME']) ?>" type="text" size="80" maxlength="255" value="<?= $arOption['VALUE'] ?>">
                        <? endif; ?>
                    </td>
                </tr>
            <? endforeach; ?>
        <? endforeach; ?>
    <? endforeach; ?>
    <? $tabControl->Buttons(['btnApply' => false, 'btnCancel' => false, 'btnSaveAndAdd' => false]); ?>
    <? $tabControl->End(); ?>
</form>