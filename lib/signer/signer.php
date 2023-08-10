<?

namespace Welpodron\Mutator;

use Bitrix\Main\Security\Sign\Signer as BitrixSigner;
use Bitrix\Main\Web\Json;
use Bitrix\Main\Config\Option;

class Signer
{
    const DEFAULT_MODULE_ID = 'welpodron.mutator';

    private static $cipher = 'aes-256-cbc';
    private static $iv = 'xfmsvP0kF0CkJWWC/1Lo0Q==';
    // private static $key = 'EdQwQHJlZGhhdC5ydQ';

    public static function sign($data)
    {
        $result = Json::encode(array_merge($data, ['S' => bitrix_sessid()]));

        if (function_exists('openssl_get_cipher_methods') && function_exists('openssl_encrypt') && in_array(self::$cipher, openssl_get_cipher_methods())) {
            $result = openssl_encrypt($result, self::$cipher, Option::get(self::DEFAULT_MODULE_ID, "KEY"), 0, base64_decode(self::$iv));

            if ($result !== false) {
                return $result;
            }
        }

        $signer = new BitrixSigner();

        $result = base64_encode($result);

        $result = $signer->sign($result, Option::get(self::DEFAULT_MODULE_ID, "KEY"));

        return $result;
    }

    public static function unsign($data)
    {
        $result = false;

        if (function_exists('openssl_get_cipher_methods') && function_exists('openssl_decrypt') && in_array(self::$cipher, openssl_get_cipher_methods())) {
            $result = openssl_decrypt($data, self::$cipher, Option::get(self::DEFAULT_MODULE_ID, "KEY"), 0, base64_decode(self::$iv));
        }

        if ($result === false) {
            $signer = new BitrixSigner();

            $result = $signer->unsign($data, Option::get(self::DEFAULT_MODULE_ID, "KEY"));

            $result = base64_decode($result);
        }

        $result = Json::decode($result);

        return $result;
    }
}
