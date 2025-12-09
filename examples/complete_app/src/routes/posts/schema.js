const { createSchema, validators, validatePartial } = require('lieko-express');

const createPostSchema = createSchema({
  title: [
    validators.required(),
    validators.string(),
    validators.minLength(5),
    validators.maxLength(100),
  ],
  content: [
    validators.required(),
    validators.string(),
    validators.minLength(10),
  ],
  published: [
    validators.optional(),
    validators.boolean()
  ]
});

const updatePostSchema = validatePartial(createPostSchema);

module.exports = {
  createPostSchema,
  updatePostSchema
};