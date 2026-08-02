La convention retenue est `export default` (déjà majoritaire : 5 fichiers sur 9, et alignée avec la direction ESM du projet). Je modifie les 4 fichiers qui utilisent `module.exports` en ne touchant qu'à la ligne d'export.

Fichiers à corriger :
1. api/checkout.js : `module.exports = async function handler(req, res){` → `export default async function handler(req, res){`
2. api/portal.js : idem
3. api/stripe-webhook.js : idem
4. api/push-send.js : idem (je conserve le `require('web-push')` interne puisque la demande ne porte que sur la convention d'export)

Chaque modification ne change que la ligne `module.exports = async function handler(re, res){` → `export default async function handler(req, res){`. Le reste du fichier reste strictement identique (le `;` final reste, sans impact en ESM).