const { schema, validators, validatePartial } = require('lieko-express');

const createCommentSchema = schema({
  postId: [
    validators.required(),
    validators.number(),
    validators.min(1)
  ],
  text: [
    validators.required(),
    validators.string(),
    validators.minLength(3),
    validators.maxLength(500)
  ]
});

const updateCommentSchema = validatePartial(createCommentSchema);

module.exports = {
  createCommentSchema,
  updateCommentSchema
};