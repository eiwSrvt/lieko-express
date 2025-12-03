const { Router, validate } = require('lieko-express');
const { createPostSchema, updatePostSchema } = require('./schema');

const {
  listPosts,
  getPost,
  createPost,
  publishPost,
  updatePost
} = require('./controller');

const router = Router();

router.get('/', listPosts);
router.get('/:id', getPost);

router.post('/', validate(createPostSchema), createPost);
router.patch('/:id', validate(updatePostSchema), updatePost);
router.patch('/:id/publish', publishPost);

module.exports = router;
