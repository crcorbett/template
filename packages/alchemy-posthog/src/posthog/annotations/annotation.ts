import type { Input } from "alchemy-effect";
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
   * @example "2025-01-15T12:00:00Z"
   */
  dateMarker?: string | null;

  /**
   * How the annotation was created.
   */
  creationType?: "USR" | "GIT";

  /**
   * Attached insight (dashboard item) ID.
   */
  dashboardItem?: Input<number | null>;

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
export interface AnnotationAttrs<_Props extends Input.Resolve<AnnotationProps> = Input.Resolve<AnnotationProps>> {
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
 * A PostHog Annotation for marking notable events on charts.
 *
 * @section Creating Annotations
 * @example Project-wide Annotation
 * ```typescript
 * class DeployAnnotation extends Annotation("DeployAnnotation", {
 *   content: "v2.0 deployed to production",
 *   dateMarker: "2025-01-15T12:00:00Z",
 *   scope: "project",
 * }) {}
 * ```
 *
 * @example Annotation Linked to Insight
 * ```typescript
 * class InsightAnnotation extends Annotation("InsightAnnotation", {
 *   content: "Marketing campaign started",
 *   dateMarker: "2025-03-01T00:00:00Z",
 *   dashboardItem: myInsight.id,
 *   scope: "dashboard_item",
 * }) {}
 * ```
 */
export interface Annotation<
  ID extends string = string,
  Props extends AnnotationProps = AnnotationProps,
> extends Resource<
    "PostHog.Annotation",
    ID,
    Props,
    AnnotationAttrs<Input.Resolve<Props>>,
    Annotation
  > {}

export const Annotation = Resource<{
  <const ID extends string, const Props extends AnnotationProps>(
    id: ID,
    props: Props
  ): Annotation<ID, Props>;
}>("PostHog.Annotation");
