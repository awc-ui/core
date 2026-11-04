// fi harness (simulator only): the iOS 26.3 simulator runtime's font cache (FontServices libGSFontCache) names
// System/Library/Fonts/Core/AppleColorEmoji.ttc, a file the simulator runtime does not ship; it ships the same face as
// System/Library/Fonts/CoreAddition/AppleColorEmoji-160px.ttc (the file the iOS 18.6 runtime uses). Every emoji then
// falls back to LastResort ("?" boxes). Inserted with DYLD_INSERT_LIBRARIES into the fixture app only, this maps that one
// missing path to the runtime's own file. Nothing else is touched.
#include <dlfcn.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
#include <sys/attr.h>

static const char *missing = "/System/Library/Fonts/Core/AppleColorEmoji.ttc";
static char target[2048];
static const char *map(const char *path) {
    if (!path) return path;
    size_t n = strlen(path), m = strlen(missing);
    if (n < m || strcmp(path + n - m, missing) != 0) return path;
    if (n - m + 64 >= sizeof(target)) return path;
    memcpy(target, path, n - m); strcpy(target + (n - m), "/System/Library/Fonts/CoreAddition/AppleColorEmoji-160px.ttc");
    return target;
}
static int my_open(const char *path, int flags, ...) { int mode = 0; if (flags & O_CREAT) { va_list ap; va_start(ap, flags); mode = va_arg(ap, int); va_end(ap); } return open(map(path), flags, mode); }
static int my_openat(int fd, const char *path, int flags, ...) { int mode = 0; if (flags & O_CREAT) { va_list ap; va_start(ap, flags); mode = va_arg(ap, int); va_end(ap); } return openat(fd, map(path), flags, mode); }
static int my_stat(const char *path, struct stat *st) { return stat(map(path), st); }
static int my_lstat(const char *path, struct stat *st) { return lstat(map(path), st); }
static int my_fstatat(int fd, const char *path, struct stat *st, int flag) { return fstatat(fd, map(path), st, flag); }
static int my_access(const char *path, int mode) { return access(map(path), mode); }
static int my_faccessat(int fd, const char *path, int mode, int flag) { return faccessat(fd, map(path), mode, flag); }
static FILE *my_fopen(const char *path, const char *mode) { return fopen(map(path), mode); }
static int my_getattrlist(const char *path, void *list, void *buf, size_t size, unsigned int opts) { return getattrlist(map(path), list, buf, size, opts); }
#define INTERPOSE(r, o) __attribute__((used)) static struct { const void *replacement; const void *original; } interpose_##o __attribute__((section("__DATA,__interpose"))) = { (const void *)(unsigned long)&r, (const void *)(unsigned long)&o };
INTERPOSE(my_open, open)
INTERPOSE(my_openat, openat)
INTERPOSE(my_stat, stat)
INTERPOSE(my_lstat, lstat)
INTERPOSE(my_fstatat, fstatat)
INTERPOSE(my_access, access)
INTERPOSE(my_faccessat, faccessat)
INTERPOSE(my_fopen, fopen)
INTERPOSE(my_getattrlist, getattrlist)
