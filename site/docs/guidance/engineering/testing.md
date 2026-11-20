# Testing

Test behavior through an interface a user or caller uses. Name each test for the outcome, such as "rejects an expired token". Cover failed operations as well as successful ones. A bug fix starts with a reproducing test; confirm it fails for the bug before fixing it.

## Choose the layer

Default to integration tests through a public function, command, route or rendered component, using real internal modules and real storage. These tests should cover most behavior, including error branches and the wiring between modules.

Use unit tests for pure calculations, parsers, formatters, validators and state machines with many input combinations. If a unit test needs to mock another project module, move the test to the integration layer.

Keep a few end-to-end tests for critical journeys and behavior only the full system can expose, such as browser interactions, deployment wiring or third-party redirects. Cover routine edge cases at the integration layer.

## Control dependencies

Mock only boundaries you cannot control: third-party services, external HTTP, time and randomness. Keep project modules and business logic real. Use the same database engine as production in a disposable test environment, rather than a substitute with different behavior. External fakes must match the real contract, including failure responses.

Give each test independent state. Use temporary directories, isolated database transactions or databases per worker, and OS-assigned ports. Restore environment variables, mocks, clocks and global state during teardown. Close resources and await background work even when assertions fail. Test helpers belong in test code; don't add production methods solely to inspect internals.

## Assert observable results

Assert return values and typed failures for libraries, status and body for APIs, and visible text, roles and labels for UI. Verify persistence through the public read interface when persistence is the behavior. Avoid assertions on private methods, internal state, CSS classes or whether an internal mock was called.

Use assertions that show expected and actual values. Compare structured values directly instead of reducing a mismatch to a boolean. Check error codes and relevant fields when wording isn't the contract. Keep test setup small enough that the action and expected result are easy to find.

## Wait for completion

Await operations and task completion. For eventual results, use the framework's condition waits or bounded polling with a useful timeout message. Never guess a delay with a fixed sleep. Register event or response listeners before triggering the action. Keep repeated wait callbacks free of side effects, and ensure a failed condition actually retries.

## Diagnose flaky tests

Compare repeated isolated runs with runs alongside neighboring tests. A failure only in a group suggests leaked state or order dependence; bisect the order to find the polluter. Random failures suggest unawaited work or a race. Port, file-lock and connection failures suggest workers sharing resources. CI-only failures call for checking environment, time zone and file order.

Fix the cause, then repeat the configuration that failed. Don't hide failures with retries, longer sleeps, skipped tests or weaker assertions. Read executed and skipped counts; a green filter matching no tests proves nothing.

Deeper: the `ce:writing-tests` skill, when installed.
