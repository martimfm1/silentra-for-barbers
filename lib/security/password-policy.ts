const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

const PASSWORD_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])(?=.{12,128}$).+$/;

export function isStrongPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= MIN_PASSWORD_LENGTH &&
    value.length <= MAX_PASSWORD_LENGTH &&
    PASSWORD_COMPLEXITY.test(value)
  );
}

export const PASSWORD_POLICY_MESSAGE =
  'A palavra-passe deve ter entre 12 e 128 caracteres e incluir maiúsculas, minúsculas, números e caracteres especiais.';
