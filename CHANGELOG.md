# v3.0.0
- added basic accounts support
- `notifConnector` method now always use smart-notifier/kraken format
- upgraded `postConnector` method to send connector data (this affects also triggering a batch extract)

# v2.1.2
- added `stubUsersSegments` and `stubAccountsSegments` for separate segments definition
- marked `stubSegments` as deprecated

# v2.1.1
- added documentation
- renamed `getOrgAddr` into `_getOrgAddr` to make it an utility method

# v2.1.0
- added `smartNotifyConnector` method
