PYTHON ?= python3

.PHONY: check test package parity

check: test package

test:
	npm --prefix chrome-extension test

package:
	$(PYTHON) chrome-web-store/prepare.py
	$(PYTHON) scripts/verify-candidate.py

parity:
	bash scripts/check-parity.sh
