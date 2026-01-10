export type User = {
  id: number;
  name: string;
  email: string;
};

export function getDisplayName(user: User): string {
  return user.name || user.email;
}
