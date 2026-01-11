/**
 * Option-based utilities for nullable handling
 *
 * Provides Option helpers for auth domain to replace | undefined patterns.
 * Use these utilities to work with nullable values in a type-safe manner.
 */

import type {
  Account,
  Role,
  Session,
  SessionId,
  User,
  UserId,
} from "@packages/types";

import { Option } from "effect";

// =============================================================================
// Generic Option Utilities
// =============================================================================

/**
 * Converts a nullable value to an Option
 *
 * @example
 * ```ts
 * const user = fromNullable(await db.findUser(id))
 * // Returns Option<User>
 * ```
 */
export const fromNullable = <A>(
  value: A | null | undefined
): Option.Option<A> => Option.fromNullable(value);

/**
 * Converts an Option to a nullable value
 *
 * @example
 * ```ts
 * const user: User | undefined = toNullable(findUser(id))
 * ```
 */
export const toNullable = <A>(option: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(option);

/**
 * Gets the value from an Option or returns a default
 *
 * @example
 * ```ts
 * const name = getOrDefault(user.name, () => "Anonymous")
 * ```
 */
export const getOrDefault = <A>(
  option: Option.Option<A>,
  defaultValue: () => A
): A => Option.getOrElse(option, defaultValue);

/**
 * Maps a function over an Option value if present
 *
 * @example
 * ```ts
 * const userId = mapOption(findUser(id), user => user.id)
 * // Returns Option<UserId>
 * ```
 */
export const mapOption = <A, B>(
  option: Option.Option<A>,
  f: (a: A) => B
): Option.Option<B> => Option.map(option, f);

/**
 * FlatMaps a function over an Option value if present
 *
 * @example
 * ```ts
 * const session = flatMapOption(findUser(id), user => findSessionByUser(user.id))
 * // Returns Option<Session>
 * ```
 */
export const flatMapOption = <A, B>(
  option: Option.Option<A>,
  f: (a: A) => Option.Option<B>
): Option.Option<B> => Option.flatMap(option, f);

/**
 * Filters an Option based on a predicate
 *
 * @example
 * ```ts
 * const activeSession = filterOption(findSession(id), s => !isExpired(s))
 * // Returns Option<Session> (None if expired)
 * ```
 */
export const filterOption = <A>(
  option: Option.Option<A>,
  predicate: (a: A) => boolean
): Option.Option<A> => Option.filter(option, predicate);

/**
 * Matches on an Option value with handlers for both cases
 *
 * @example
 * ```ts
 * const message = matchOption(findUser(id), {
 *   onNone: () => "User not found",
 *   onSome: user => `Hello, ${user.name}`
 * })
 * ```
 */
export const matchOption = <A, B, C>(
  option: Option.Option<A>,
  handlers: { onNone: () => B; onSome: (a: A) => C }
): B | C => Option.match(option, handlers);

/**
 * Checks if an Option is Some
 */
export const isSome = <A>(option: Option.Option<A>): option is Option.Some<A> =>
  Option.isSome(option);

/**
 * Checks if an Option is None
 */
export const isNone = <A>(option: Option.Option<A>): option is Option.None<A> =>
  Option.isNone(option);

// =============================================================================
// Auth Domain Option Helpers
// =============================================================================

/**
 * Creates a finder function that returns Option<T> from nullable results
 *
 * @example
 * ```ts
 * const findUser = createFinder<User>();
 * const user = findUser(await db.query.users.findFirst({ where: eq(users.id, id) }))
 * // Returns Option<User>
 * ```
 */
export const createFinder =
  <T>() =>
  (value: T | null | undefined): Option.Option<T> =>
    Option.fromNullable(value);

/**
 * User finder - converts nullable user to Option<User>
 *
 * @example
 * ```ts
 * const user = findUser(await db.users.findUnique({ where: { id } }))
 * // Returns Option<User>
 * ```
 */
export const findUser = (value: User | null | undefined): Option.Option<User> =>
  Option.fromNullable(value);

/**
 * Session finder - converts nullable session to Option<Session>
 *
 * @example
 * ```ts
 * const session = findSession(await db.sessions.findUnique({ where: { id } }))
 * // Returns Option<Session>
 * ```
 */
export const findSession = (
  value: Session | null | undefined
): Option.Option<Session> => Option.fromNullable(value);

/**
 * Role finder - converts nullable role to Option<Role>
 *
 * @example
 * ```ts
 * const role = findRole(await db.roles.findUnique({ where: { name } }))
 * // Returns Option<Role>
 * ```
 */
export const findRole = (value: Role | null | undefined): Option.Option<Role> =>
  Option.fromNullable(value);

/**
 * Account finder - converts nullable account to Option<Account>
 *
 * @example
 * ```ts
 * const account = findAccount(await db.accounts.findUnique({ where: { id } }))
 * // Returns Option<Account>
 * ```
 */
export const findAccount = (
  value: Account | null | undefined
): Option.Option<Account> => Option.fromNullable(value);

// =============================================================================
// Option Combinators for Auth Domain
// =============================================================================

/**
 * Gets the user ID from an Option<User>
 *
 * @example
 * ```ts
 * const userId = getUserId(findUser(rawUser))
 * // Returns Option<UserId>
 * ```
 */
export const getUserId = (user: Option.Option<User>): Option.Option<UserId> =>
  Option.map(user, (u) => u.id);

/**
 * Gets the session ID from an Option<Session>
 *
 * @example
 * ```ts
 * const sessionId = getSessionId(findSession(rawSession))
 * // Returns Option<SessionId>
 * ```
 */
export const getSessionId = (
  session: Option.Option<Session>
): Option.Option<SessionId> => Option.map(session, (s) => s.id);

/**
 * Gets the user email from an Option<User>
 *
 * @example
 * ```ts
 * const email = getUserEmail(findUser(rawUser))
 * // Returns Option<Email>
 * ```
 */
export const getUserEmail = (
  user: Option.Option<User>
): Option.Option<User["email"]> => Option.map(user, (u) => u.email);

/**
 * Filters sessions to only active (non-expired) ones
 *
 * @example
 * ```ts
 * const activeSession = filterActiveSession(findSession(rawSession))
 * // Returns Option<Session> (None if expired)
 * ```
 */
export const filterActiveSession = (
  session: Option.Option<Session>
): Option.Option<Session> =>
  Option.filter(session, (s) => s.expiresAt > new Date());

/**
 * Chains user lookup with session lookup
 *
 * @example
 * ```ts
 * const userSession = chainUserSession(
 *   findUser(rawUser),
 *   userId => findSession(db.sessions.findFirst({ where: { userId } }))
 * )
 * ```
 */
export const chainUserSession = (
  user: Option.Option<User>,
  getSession: (userId: UserId) => Option.Option<Session>
): Option.Option<Session> => Option.flatMap(user, (u) => getSession(u.id));

// =============================================================================
// Option Batch Operations
// =============================================================================

/**
 * Combines multiple Options into a tuple, returning None if any is None
 *
 * @example
 * ```ts
 * const combined = zipOptions(findUser(u), findSession(s))
 * // Returns Option<[User, Session]>
 * ```
 */
export const zipOptions = <A, B>(
  optionA: Option.Option<A>,
  optionB: Option.Option<B>
): Option.Option<readonly [A, B]> =>
  Option.flatMap(optionA, (a) => Option.map(optionB, (b) => [a, b] as const));

/**
 * Combines three Options into a tuple, returning None if any is None
 *
 * @example
 * ```ts
 * const combined = zip3Options(findUser(u), findSession(s), findRole(r))
 * // Returns Option<[User, Session, Role]>
 * ```
 */
export const zip3Options = <A, B, C>(
  optionA: Option.Option<A>,
  optionB: Option.Option<B>,
  optionC: Option.Option<C>
): Option.Option<readonly [A, B, C]> =>
  Option.flatMap(optionA, (a) =>
    Option.flatMap(optionB, (b) =>
      Option.map(optionC, (c) => [a, b, c] as const)
    )
  );

/**
 * Returns the first Some Option from a list, or None if all are None
 *
 * @example
 * ```ts
 * const session = firstSome([
 *   findSession(byToken),
 *   findSession(byCookie),
 *   findSession(byHeader)
 * ])
 * ```
 */
export const firstSome = <A>(
  options: readonly Option.Option<A>[]
): Option.Option<A> => {
  for (const opt of options) {
    if (Option.isSome(opt)) {
      return opt;
    }
  }
  return Option.none();
};

/**
 * Collects all Some values from a list of Options
 *
 * @example
 * ```ts
 * const sessions = collectSome([findSession(id1), findSession(id2), findSession(id3)])
 * // Returns Session[] (only the ones that were found)
 * ```
 */
export const collectSome = <A>(
  options: readonly Option.Option<A>[]
): readonly A[] => options.filter(Option.isSome).map((opt) => opt.value);

// =============================================================================
// Option Error Recovery
// =============================================================================

/**
 * Provides an alternative Option if the first is None
 *
 * @example
 * ```ts
 * const session = orElse(findSessionByToken(token), () => findSessionByCookie(cookie))
 * ```
 */
export const orElse = <A>(
  option: Option.Option<A>,
  alternative: () => Option.Option<A>
): Option.Option<A> => Option.orElse(option, alternative);

/**
 * Provides an alternative value wrapped in Some if the Option is None
 *
 * @example
 * ```ts
 * const user = orElseSome(findUser(id), () => defaultUser)
 * // Always returns Some<User>
 * ```
 */
export const orElseSome = <A>(
  option: Option.Option<A>,
  alternative: () => A
): Option.Option<A> => Option.orElse(option, () => Option.some(alternative()));
