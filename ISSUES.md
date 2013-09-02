Known Issues
============
(as of v0.05)

In order of priority:

* "Add to HyperPin" under download options is not yet implemented.
* The download queue still has a few display bugs. Transfers also need more frontend logging,
  everything that is post-processing is not displayed.
* Table versioning is not working. If you download a new version of a table that is already
  in HyperPin, another entry will be created.
* Messed up settings leads probably to a crash. Need to add a validator on first run.
* IPDB matching is based on current HP conventions. If the description is different than
  `Game Name (Manufacturer Year)`, matching will probably fail.
* Future Pinball support is very minimal. Right now, Hyperpin's database gets read for VP and
  FP, but that's about it. Don't expect anything more to work right now (high scores, media
  downloads, etc).
