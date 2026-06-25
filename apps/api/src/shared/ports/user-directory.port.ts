export const USER_DIRECTORY_PORT = Symbol('USER_DIRECTORY_PORT');

export type UserContact = {
  id: string;
  name: string;
  phoneNumber: string | null;
};

export interface IUserDirectoryPort {
  findEmail(userId: string): Promise<string | null>;
  findContact(userId: string): Promise<UserContact | null>;
  promoteToRestaurant(userId: string): Promise<void>;
}
