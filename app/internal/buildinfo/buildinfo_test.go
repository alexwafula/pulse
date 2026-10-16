package buildinfo

import "testing"

func TestCurrent(t *testing.T) {
	old := [3]string{SHA, BuiltAt, Ref}
	t.Cleanup(func() { SHA, BuiltAt, Ref = old[0], old[1], old[2] })
	for _, test := range []struct {
		sha, builtAt, ref string
		want              Info
	}{
		{"", "", "", Info{"unknown", "unknown", "unknown", "unknown"}},
		{" ", "\t", "\n", Info{"unknown", "unknown", "unknown", "unknown"}},
		{"0123456789abcdef0123456789abcdef01234567", "2026-10-16T12:00:00Z", "refs/heads/main",
			Info{"0123456789abcdef0123456789abcdef01234567", "0123456", "2026-10-16T12:00:00Z", "refs/heads/main"}},
		{"abc12", "", "", Info{"abc12", "abc12", "unknown", "unknown"}},
	} {
		SHA, BuiltAt, Ref = test.sha, test.builtAt, test.ref
		if got := Current(); got != test.want {
			t.Fatalf("Current() with %q/%q/%q = %+v; want %+v", test.sha, test.builtAt, test.ref, got, test.want)
		}
	}
}
