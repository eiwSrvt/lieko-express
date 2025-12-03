const { Router, validate } = require('lieko-express');

const {
  listComments,
  getComment,
  createComment,
  approveComment,
  updateComment
} = require('./controller');

const { createCommentSchema, updateCommentSchema } = require('./schema');

const router = Router();

router.get('/', listComments);
router.get('/:id', getComment);

router.post('/', validate(createCommentSchema), createComment);

router.patch('/:id', validate(updateCommentSchema), updateComment);
router.patch('/:id/approve', approveComment);

module.exports = router;
