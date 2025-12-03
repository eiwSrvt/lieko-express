const { Router, validate } = require('lieko-express');

const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser
} = require('./controller');

const {
  createUserSchema,
  updateUserSchema
} = require('./schema');

const router = Router();

router.post('/', validate(createUserSchema), createUser);

router.get('/', listUsers);
router.get('/:id', getUser);
router.patch('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
