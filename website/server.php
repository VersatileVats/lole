<?php

header("Access-Control-Allow-Headers: Authorization, Content-Type");
header("Access-Control-Allow-Origin: *");
header('content-type: application/json; charset=utf-8');

$headers = getallheaders();
$requestOrigin = $headers['Origin'] ?? $headers['origin'] ?? 'unknown';

// Check if the request is NOT from a chrome-extension
if (!str_contains($requestOrigin, "chrome-extension://")) {
    http_response_code(403);

    echo json_encode([
        "status" => "error",
        "requestedFrom" => $requestOrigin
    ]);

    exit;
}

require '/home/u195637119/domains/versatilevats.com/public_html/phpComposer/dotEnv/vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable("/home/u195637119/domains/versatilevats.com/public_html/phpComposer");
$dotenv->load();

$encryption_key = $_ENV['AES_ENCRYPT_KEY'];
$divider = "##00##";

// function for uploading the file that is coming from the extension (pdf/doc/txt)
function uploadFile()
{
    // Check if file was actually uploaded
    if (!isset($_FILES['uploadedFile'])) {
        http_response_code(400);
        return json_encode(["status" => "error", "message" => "No file uploaded"]);
    }

    $product = $_FILES['uploadedFile']['name'];
    $code = $_POST['code'] ?? 'default';

    // Sanitize the filename to remove weird characters
    $safeName = preg_replace("/[^a-zA-Z0-9\._-]/", "", $product);
    $newName = $code . "-" . $safeName;
    $targetPath = "./files/" . $newName;

    $tmp = $_FILES['uploadedFile']['tmp_name'];

    if (move_uploaded_file($tmp, $targetPath)) {
        return json_encode([
            "status" => "success",
            "message" => "Upload complete",
            "fileName" => $newName
        ]);
    } else {
        http_response_code(500);
        return json_encode(["status" => "error", "message" => "Move failed"]);
    }
}

switch ($_GET['action']) {
    case 'uploadFile':
        echo uploadFile();
        break;

    case 'unlink':
        $fileParam = $_GET['file'] ?? '';
        // Extract just the filename to prevent ../../ path attacks
        $fileName = basename($fileParam);
        $filePath = "./files/" . $fileName;

        if (!empty($fileName) && file_exists($filePath)) {
            if (unlink($filePath)) {
                echo json_encode(["status" => "success", "message" => "File deleted"]);
            } else {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Failed to delete file"]);
            }
        } else {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "File not found"]);
        }
        break;

    // called at the time of extension install to create the IV for AES-256 encryption
    case 'createNoteFile':
        $code = $_GET['code'] ?? '';
        $cleanCode = preg_replace("/[^a-zA-Z0-9_-]/", "", $code);

        if (!empty($cleanCode)) {
            $filePath = "./notes/" . $cleanCode . ".txt";

            $cipher = "aes-256-cbc";
            $iv_length = openssl_cipher_iv_length($cipher);
            $iv = bin2hex(openssl_random_pseudo_bytes($iv_length)) . "##00##";

            if (file_put_contents($filePath, $iv) !== false) {
                echo json_encode([
                    "status" => "success",
                    "message" => "File created",
                    "file" => $cleanCode . ".txt"
                ]);
            } else {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Could not create file"]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid or missing code"]);
        }
        break;

    // decrypt the notes and send them back
    case 'sendNotes':
        $code = $_GET['code'] ?? '';
        $cleanCode = preg_replace("/[^a-zA-Z0-9_-]/", "", $code);
        $filePath = "./notes/" . $cleanCode . ".txt";
        $divider = "##00##";
        $encryptionMethod = "aes-256-cbc";

        if (empty($cleanCode)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid code"]);
            break;
        }

        // --- Auto create login (might be at the time of install, there was no internet connection) ---
        if (!file_exists($filePath)) {
            $iv_length = openssl_cipher_iv_length($encryptionMethod);
            $newIvHex = bin2hex(openssl_random_pseudo_bytes($iv_length));

            // Create file with just the IV and the divider
            if (file_put_contents($filePath, $newIvHex . $divider) === false) {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Failed to auto-create note file"]);
                break;
            }
        }

        $fileContent = file_get_contents($filePath);

        if (str_contains($fileContent, $divider)) {
            $parts = explode($divider, $fileContent);
            $ivHex = $parts[0];
            $encryptedData = $parts[1] ?? ''; // Handle case where file is newly created

            if (empty($encryptedData)) {
                echo json_encode([
                    "status" => "success",
                    "notes" => "",
                    "message" => "No notes saved as of now."
                ]);
            } else {
                // Decrypt using hex2bin for the IV
                $decryptedNotes = openssl_decrypt(
                    $encryptedData,
                    $encryptionMethod,
                    $encryption_key,
                    0,
                    hex2bin($ivHex)
                );

                if ($decryptedNotes === false) {
                    http_response_code(500);
                    echo json_encode(["status" => "error", "message" => "Decryption failed"]);
                } else {
                    echo json_encode(["status" => "success", "notes" => $decryptedNotes]);
                }
            }
        } else {
            echo json_encode(["status" => "error", "message" => "File format invalid (missing divider)"]);
        }
        break;

    case 'saveNotes':
        $code = $_GET['code'] ?? '';
        $newNotes = $_POST['notes'] ?? '';
        $cleanCode = preg_replace("/[^a-zA-Z0-9_-]/", "", $code);
        $filePath = "./notes/" . $cleanCode . ".txt";

        if (!empty($cleanCode) && file_exists($filePath)) {
            // 1. Read the file to get the existing IV
            $fileContent = file_get_contents($filePath);
            $parts = explode($divider, $fileContent);
            $iv = hex2bin($parts[0]);

            // 2. Encrypt the new notes using the existing IV
            // IMPORTANT: Use the same key and method as your decryption logic
            $encryptionMethod = "aes-256-cbc";

            $encryptedData = openssl_encrypt($newNotes, $encryptionMethod, $encryption_key, 0, $iv);

            if ($encryptedData === false) {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Encryption failed."]);
            } else {
                // 3. Reconstruct the file: [IV][Divider][New Encrypted Data]
                $finalContent = bin2hex($iv) . $divider . $encryptedData;

                if (file_put_contents($filePath, $finalContent) !== false) {
                    echo json_encode(["status" => "success", "message" => "Notes updated successfully."]);
                } else {
                    http_response_code(500);
                    echo json_encode(["status" => "error", "message" => "Failed to write to file."]);
                }
            }
        } else {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Note file not found."]);
        }
        break;
}

// stopping unnecessary execution of the code
if (isset($_GET['action'])) {
    return;
}

// Get JSON as a string
$json_str = file_get_contents('php://input');

// Decode the JSON into an array
$body = json_decode($json_str, true);

// for the shared view
if (isset($_GET['code'])) {
    $filename = "shares/" . $_GET['code'] . ".txt";
    if (file_exists($filename)) {
        // 1. Get the full content
        $content = file_get_contents($filename);
        $data = json_decode($content, true);

        // 2. Define the keys you actually want to keep
        $allowedKeys = ['docFile', 'pdfFile', 'txtFile', 'specificText', 'entirePage', 'image', 'code'];

        // 3. Filter the array to keep only those keys
        // array_intersect_key compares the data against a flipped version of your allowed list
        $filteredData = array_intersect_key($data, array_flip($allowedKeys));

        // 4. Return the minimal JSON
        header('Content-Type: application/json');
        echo json_encode($filteredData);
    } else {
        // echo json_encode{"error": ""});
        echo json_encode(["status" => "error", "message" => "File could not be found"]);
    }
}
// storing the bookmarked data
else {
    $file = fopen("shares/" . $body['code'] . ".txt", "w");
    fwrite($file, $json_str);
    fclose($file);

    print_r(json_encode($body));
}
