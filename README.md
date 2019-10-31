# perltidy-more

Perltidy extension for Visual Studio Code.

More perltidy, then pertidy extension by sfodje.

This perltidy has some extended features:

- It has [github repository](https://github.com/kak-tus/perltidy-more) (now sfodje perltidy has [repository](https://github.com/sfodje/perltidy) too).
- It can format large perl files (in my case sfodje extension had 10 or 20 KB file limit. I don't know why it happened).
- It can format selected text.
- Partial support for virtual filesystems like SSH FS (without support of .perltidyrc from virtual fs).
- Option to enable perltidy only with existing .perltidyrc in project.

Alternatives
1. [sfodje perltidy](https://github.com/sfodje/perltidy).
2. [henriiik intelligence extension](https://github.com/henriiik/vscode-perl) (it can format, but I couldn't get it work).

## Attention

VS Code can have multiple formatting extensions for same language installed, but only one of them (selected by some magical "score") will be using for formatting by formatting key.

If this extension does not work:

1. Try to use it with command (F1 or Ctrl+Shift+P: perltidy).
2. Try to disable other perl formatting extensions.
3. Try to install perltidy binary from your OS repository.

## FAQ

### 1. Q: I'd like to use .perltidyrc specific to different projects.

A: Use "perltidy-more.profile" option and set it to ".../.perltidyrc". Three dots is perltidy specific option to indicates that the file should be searched for starting in the current directory and working upwards. This makes it easier to have multiple projects each with their own .perltidyrc in their root directories.
