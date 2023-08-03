<?

use Bitrix\Main\Loader;

CJSCore::RegisterExt('welpodron.mutator', [
    'js' => '/bitrix/js/welpodron.mutator/script.js',
    'skip_core' => true
]);

Loader::registerAutoLoadClasses(
    'welpodron.mutator',
    [
        'Welpodron\Mutator\Signer' => 'lib/signer/signer.php',
    ]
);
