# ralph-once.sh
# Usage: ./ralph-once.sh "<prompt>" [iterations]

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 \"<prompt>\" [iterations]"
  echo "Example: $0 \"@plan.md @progress.txt Work on the next task\" 5"
  exit 1
fi

PROMPT="$1"
ITERATIONS="${2:-1}"

# Append the COMPLETE promise instruction to the user's prompt
FULL_PROMPT="${PROMPT}"

# For each iteration, run Claude Code with the prompt
for ((i=1; i<=$ITERATIONS; i++)); do
  echo "=== Iteration $i/$ITERATIONS ==="
  result=$(docker sandbox --mount-docker-socket run claude -p "$FULL_PROMPT")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "PRD complete, exiting."
    exit 0
  fi
done
