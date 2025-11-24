const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

router.get('/', userController.getAllUsers);
router.get('/myProfile', auth, userController.getUserById);
router.put('/:id',auth, userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.get('/roles/:id', auth, userController.getUserRoles);
router.get('/aggregated-users', auth, userController.getAllAggregatedUser)
router.post('/', userController.createUser);
//  router.put('/address/myaddress', auth, userController.addUserAddress);
//  router.get("/address/myaddress", auth, userController.getUserAddress);

module.exports = router;