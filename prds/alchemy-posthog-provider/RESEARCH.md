# Research Notes

## ACT-001
- Action resource follows same pattern as Cohort: `name` is `string | null`, `tags` in attrs is `unknown[] | undefined`
- ActionStepDef has 10 optional fields for matching steps (event, properties, selector, tagName, text, textMatching, href, hrefMatching, url, urlMatching)
- No replacement triggers for Actions - all prop changes are updates
