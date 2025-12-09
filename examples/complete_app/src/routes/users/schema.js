const { createSchema, validators, validatePartial } = require('lieko-express');

const createUserSchema = createSchema({
  username: [
    validators.required(),
    validators.string(),
    validators.minLength(3)
  ],
  email: [
    validators.required(),
    validators.string(),
    validators.email()
  ],
  age: [
    validators.required(),
    validators.number(),
    validators.min(1)
  ],
  active: [
    validators.optional(),
    validators.boolean()
  ]
});

const updateUserSchema = validatePartial(createUserSchema);

module.exports = {
  createUserSchema,
  updateUserSchema
};