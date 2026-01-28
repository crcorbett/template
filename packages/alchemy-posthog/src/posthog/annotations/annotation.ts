import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating a PostHog Annotation.
 */
export interface AnnotationProps {
  /**
   * Annotation text content.
   */
  content?: string | null;

  /**
   * ISO date string marking the position of the annotation.
   */
  dateMarker?: string | null;

  /**
   * How the annotation was created.
   */
  creationType?: "USR" | "GIT";

  /**
   * Attached insight (dashboard item) ID.
   */
  dashboardItem?: number | null;

  /**
   * Scope of the annotation.
   */
  scope?:
    | "dashboard_item"
    | "dashboard"
    | "project"
    | "organization"
    | "recording";
}

/**
 * Output attributes for a PostHog Annotation resource.
 */
export interface AnnotationAttrs {
  /**
   * Server-generated ID (stable).
   */
  id: number;

  /**
   * Annotation text content.
   */
  content: string | null | undefined;

  /**
   * ISO date marker.
   */
  dateMarker: string | null | undefined;

  /**
   * Scope.
   */
  scope: string | undefined;

  /**
   * ISO creation timestamp.
   */
  createdAt: string | null | undefined;
}

/**
 * PostHog Annotation resource.
 */
export interface Annotation<
  ID extends string = string,
  Props extends AnnotationProps = AnnotationProps,
> extends Resource<
    "PostHog.Annotations.Annotation",
    ID,
    Props,
    AnnotationAttrs,
    Annotation
  > {}

export const Annotation = Resource<{
  <const ID extends string, const Props extends AnnotationProps>(
    id: ID,
    props: Props
  ): Annotation<ID, Props>;
}>("PostHog.Annotations.Annotation");
