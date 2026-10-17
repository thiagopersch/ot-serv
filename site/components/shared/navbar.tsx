"use client";

import Link from "next/link";
import NextLink from "next/link";
import { LogOut, Menu, User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { isAdmin } from "@/lib/auth-constants";
import { accountMenu, navMenu } from "@/lib/nav-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { OnlineBadge } from "@/components/shared/online-badge";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            NDBO
          </Link>
          <OnlineBadge />
        </div>

        <NavigationMenu className="hidden lg:flex">
          <NavigationMenuList>
            {navMenu.map((item) =>
              item.children ? (
                <NavigationMenuItem key={item.label}>
                  <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-56 gap-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <NavigationMenuLink
                            render={<NextLink href={child.href} />}
                          >
                            {child.label}
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ) : (
                <NavigationMenuItem key={item.label}>
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    render={<NextLink href={item.href!} />}
                  >
                    {item.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )
            )}

            <NavigationMenuItem>
              <NavigationMenuTrigger>
                <User className="mr-1 size-4" />
                {session?.user?.name ?? "Conta"}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-48 gap-1">
                  {session?.user ? (
                    <>
                      <li>
                        <NavigationMenuLink render={<NextLink href="/account" />}>
                          Minha conta
                        </NavigationMenuLink>
                      </li>
                      {isAdmin(session.user.groupId) && (
                        <li>
                          <NavigationMenuLink render={<NextLink href="/admin" />}>
                            Administração
                          </NavigationMenuLink>
                        </li>
                      )}
                      <li>
                        <button
                          type="button"
                          onClick={() => signOut()}
                          className="flex w-full items-center gap-1.5 rounded-md p-2 text-left text-sm hover:bg-muted"
                        >
                          <LogOut className="size-4" />
                          Sair
                        </button>
                      </li>
                    </>
                  ) : (
                    accountMenu.map((link) => (
                      <li key={link.href}>
                        <NavigationMenuLink render={<NextLink href={link.href} />}>
                          {link.label}
                        </NavigationMenuLink>
                      </li>
                    ))
                  )}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger
              render={<Button variant="outline" size="icon" className="lg:hidden" />}
            >
              <Menu className="size-5" />
              <span className="sr-only">Abrir menu</span>
            </SheetTrigger>
          <SheetContent side="right" className="w-72 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 px-4 pb-8">
              {navMenu.map((item) => (
                <div key={item.label} className="flex flex-col gap-1">
                  {item.href ? (
                    <Link href={item.href} className="text-sm font-medium">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">
                      {item.label}
                    </span>
                  )}
                  {item.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn("pl-3 text-sm text-muted-foreground hover:text-foreground")}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ))}

              <div className="flex flex-col gap-1 border-t pt-4">
                <span className="text-sm font-semibold text-muted-foreground">
                  Conta
                </span>
                {session?.user ? (
                  <>
                    <Link href="/account" className="pl-3 text-sm text-muted-foreground hover:text-foreground">
                      Minha conta
                    </Link>
                    {isAdmin(session.user.groupId) && (
                      <Link href="/admin" className="pl-3 text-sm text-muted-foreground hover:text-foreground">
                        Administração
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="pl-3 text-left text-sm text-muted-foreground hover:text-foreground"
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  accountMenu.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="pl-3 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  ))
                )}
              </div>
            </nav>
          </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
