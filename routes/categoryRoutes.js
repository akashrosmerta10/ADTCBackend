const express = require('express');
const router = express.Router();
const {createCategory, getAllCategory, getCategory, updateCategory, deleteCategory} = require('../controllers/categoryController');


router.get('/', getAllCategory);
router.post('/', createCategory);
router.get('/:id', getCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;