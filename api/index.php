<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

define('ADMIN_PASSWORD', getenv('LDVELH_ADMIN') ?: 'ldvelh');
define('VERSIONS_DIR', __DIR__ . '/versions');
define('READERS_DIR', __DIR__ . '/../src/data/readers');

if (!is_dir(VERSIONS_DIR)) mkdir(VERSIONS_DIR, 0755, true);

$method = $_SERVER['REQUEST_METHOD'];
$uri = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$scriptDir = trim(dirname($_SERVER['SCRIPT_NAME']), '/');
if ($scriptDir && strpos($uri, $scriptDir) === 0) {
    $uri = trim(substr($uri, strlen($scriptDir)), '/');
}
$uri = preg_replace('/^index\.php\/?/', '', $uri);
$parts = array_values(array_filter(explode('/', $uri)));

function json_response($code, $data) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function read_json($file) {
    if (!file_exists($file)) return null;
    return json_decode(file_get_contents($file), true);
}

function write_json($file, $data) {
    $dir = dirname($file);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function sanitize_book_id($id) {
    $id = preg_replace('/[^a-zA-Z0-9_\-\x{00C0}-\x{024F}]/u', '-', $id);
    $id = preg_replace('/-+/', '-', $id);
    return trim($id, '-');
}

function get_book_dir($bookId) {
    return VERSIONS_DIR . '/' . $bookId;
}

function get_meta($bookId) {
    $file = get_book_dir($bookId) . '/meta.json';
    $meta = read_json($file);
    if (!$meta) {
        $meta = ['versions' => [], 'promoted' => null];
    }
    return $meta;
}

function save_meta($bookId, $meta) {
    write_json(get_book_dir($bookId) . '/meta.json', $meta);
}

function count_sections($data) {
    return isset($data['sections']) ? count($data['sections']) : 0;
}

function diff_stats($original, $modified) {
    $origSections = [];
    if (isset($original['sections'])) {
        foreach ($original['sections'] as $s) {
            $origSections[$s['id']] = $s;
        }
    }
    $changed = 0;
    $added = 0;
    $removed = 0;
    $modIds = [];
    if (isset($modified['sections'])) {
        foreach ($modified['sections'] as $s) {
            $modIds[$s['id']] = true;
            if (!isset($origSections[$s['id']])) {
                $added++;
                continue;
            }
            $o = $origSections[$s['id']];
            if (($o['text'] ?? '') !== ($s['text'] ?? '') || json_encode($o['choices'] ?? []) !== json_encode($s['choices'] ?? [])) {
                $changed++;
            }
        }
    }
    foreach ($origSections as $id => $s) {
        if (!isset($modIds[$id])) $removed++;
    }
    return ['changed' => $changed, 'added' => $added, 'removed' => $removed];
}

if (empty($parts) || $parts[0] === '') {
    json_response(200, ['api' => 'ldvelh-versions', 'endpoints' => [
        'GET  /api/versions/{bookId}' => 'Liste des versions',
        'GET  /api/versions/{bookId}/{version}' => 'Télécharger une version',
        'GET  /api/versions/{bookId}/{version}/diff' => 'Diff avec la version promue',
        'POST /api/versions/{bookId}' => 'Soumettre une nouvelle version (body: JSON)',
        'POST /api/versions/{bookId}/{version}/promote' => 'Promouvoir (admin: password en query)',
        'DELETE /api/versions/{bookId}/{version}' => 'Supprimer (admin: password en query)',
    ]]);
}

if ($parts[0] !== 'versions' || !isset($parts[1])) {
    json_response(404, ['error' => 'Route inconnue']);
}

$bookId = sanitize_book_id(urldecode($parts[1]));
$bookDir = get_book_dir($bookId);
$meta = get_meta($bookId);

// POST /api/versions/{bookId} — soumettre nouvelle version
if ($method === 'POST' && count($parts) === 2) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['sections'])) {
        json_response(400, ['error' => 'JSON invalide ou sections manquantes']);
    }
    if (!is_dir($bookDir)) mkdir($bookDir, 0755, true);

    $versionNum = count($meta['versions']) + 1;
    $author = isset($input['_author']) ? substr(trim($input['_author']), 0, 100) : 'Anonyme';
    $note = isset($input['_note']) ? substr(trim($input['_note']), 0, 500) : '';

    unset($input['_author'], $input['_note']);

    $versionFile = $bookDir . '/v' . $versionNum . '.json';
    write_json($versionFile, $input);

    $sectionCount = count_sections($input);

    $origData = null;
    $readerFile = READERS_DIR . '/' . $bookId . '.json';
    if (file_exists($readerFile)) {
        $origData = read_json($readerFile);
    }
    $diff = $origData ? diff_stats($origData, $input) : ['changed' => $sectionCount, 'added' => 0, 'removed' => 0];

    $meta['versions'][] = [
        'id' => $versionNum,
        'author' => $author,
        'note' => $note,
        'date' => date('c'),
        'sections' => $sectionCount,
        'diff' => $diff,
    ];
    save_meta($bookId, $meta);

    json_response(201, [
        'ok' => true,
        'version' => $versionNum,
        'sections' => $sectionCount,
        'diff' => $diff,
    ]);
}

if (!isset($parts[2])) {
    if ($method === 'GET') {
        json_response(200, [
            'bookId' => $bookId,
            'promoted' => $meta['promoted'],
            'versions' => $meta['versions'],
        ]);
    }
    json_response(405, ['error' => 'Méthode non autorisée']);
}

$versionId = intval($parts[2]);
$versionMeta = null;
foreach ($meta['versions'] as $v) {
    if ($v['id'] === $versionId) { $versionMeta = $v; break; }
}
if (!$versionMeta) {
    json_response(404, ['error' => 'Version non trouvée']);
}

$versionFile = $bookDir . '/v' . $versionId . '.json';

// GET /api/versions/{bookId}/{version}/diff
if ($method === 'GET' && isset($parts[3]) && $parts[3] === 'diff') {
    $versionData = read_json($versionFile);
    if (!$versionData) json_response(404, ['error' => 'Fichier version introuvable']);

    $origData = null;
    if ($meta['promoted']) {
        $promFile = $bookDir . '/v' . $meta['promoted'] . '.json';
        $origData = read_json($promFile);
    }
    if (!$origData) {
        $readerFile = READERS_DIR . '/' . $bookId . '.json';
        if (file_exists($readerFile)) $origData = read_json($readerFile);
    }
    if (!$origData) json_response(404, ['error' => 'Pas de version de référence']);

    $origMap = [];
    foreach ($origData['sections'] ?? [] as $s) $origMap[$s['id']] = $s;
    $modMap = [];
    foreach ($versionData['sections'] ?? [] as $s) $modMap[$s['id']] = $s;

    $changed = [];
    $added = [];
    $removed = [];

    foreach ($modMap as $id => $s) {
        if (!isset($origMap[$id])) {
            $added[] = $id;
        } elseif ($origMap[$id]['text'] !== $s['text'] || json_encode($origMap[$id]['choices'] ?? []) !== json_encode($s['choices'] ?? [])) {
            $changed[] = [
                'id' => $id,
                'original' => ['text' => $origMap[$id]['text'], 'choices' => $origMap[$id]['choices'] ?? []],
                'modified' => ['text' => $s['text'], 'choices' => $s['choices'] ?? []],
            ];
        }
    }
    foreach ($origMap as $id => $s) {
        if (!isset($modMap[$id])) $removed[] = $id;
    }

    json_response(200, [
        'bookId' => $bookId,
        'version' => $versionId,
        'stats' => ['changed' => count($changed), 'added' => count($added), 'removed' => count($removed)],
        'changed' => $changed,
        'added' => $added,
        'removed' => $removed,
    ]);
}

// GET /api/versions/{bookId}/{version} — télécharger
if ($method === 'GET') {
    if (!file_exists($versionFile)) json_response(404, ['error' => 'Fichier introuvable']);
    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="' . $bookId . '-v' . $versionId . '.json"');
    readfile($versionFile);
    exit;
}

// POST /api/versions/{bookId}/{version}/promote — promouvoir (admin)
if ($method === 'POST' && isset($parts[3]) && $parts[3] === 'promote') {
    $pw = $_GET['password'] ?? '';
    $body = json_decode(file_get_contents('php://input'), true);
    if ($body && isset($body['password'])) $pw = $body['password'];
    if ($pw !== ADMIN_PASSWORD) {
        json_response(403, ['error' => 'Mot de passe incorrect']);
    }
    if (!file_exists($versionFile)) {
        json_response(404, ['error' => 'Fichier version introuvable']);
    }

    $meta['promoted'] = $versionId;
    save_meta($bookId, $meta);

    $readerFile = READERS_DIR . '/' . $bookId . '.json';
    $versionData = read_json($versionFile);
    if ($versionData && is_writable(dirname($readerFile))) {
        write_json($readerFile, $versionData);
    }

    json_response(200, ['ok' => true, 'promoted' => $versionId]);
}

// DELETE /api/versions/{bookId}/{version} — supprimer (admin)
if ($method === 'DELETE') {
    $pw = $_GET['password'] ?? '';
    if ($pw !== ADMIN_PASSWORD) {
        json_response(403, ['error' => 'Mot de passe incorrect']);
    }

    if (file_exists($versionFile)) unlink($versionFile);

    $newVersions = [];
    foreach ($meta['versions'] as $v) {
        if ($v['id'] !== $versionId) $newVersions[] = $v;
    }
    $meta['versions'] = $newVersions;
    if ($meta['promoted'] === $versionId) $meta['promoted'] = null;
    save_meta($bookId, $meta);

    json_response(200, ['ok' => true, 'deleted' => $versionId]);
}

json_response(404, ['error' => 'Route inconnue']);
