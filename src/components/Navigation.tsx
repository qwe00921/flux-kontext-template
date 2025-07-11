"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogoVariants } from "@/components/Logo"
import { ChevronDown, User, LogOut, Code, BookOpen } from "lucide-react"
// 导入文案系统
import { common } from "@/lib/content"

export function Navigation() {
  const pathname = usePathname()
  // 暂时移除 next-auth，默认显示未登录状态
  const session = null
  const status = "unauthenticated"
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isResourcesMenuOpen, setIsResourcesMenuOpen] = useState(false)
  
  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.resources-dropdown') && !target.closest('.user-dropdown')) {
        setIsResourcesMenuOpen(false)
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const navLinks = [
    { href: "/", label: common.navigation.home },
    { href: "/generate", label: common.navigation.generate },
    { href: "/pricing", label: common.navigation.pricing },
    { 
      href: "/resources", 
      label: common.navigation.resources,
      hasDropdown: true,
      subItems: [
        { href: "/resources", label: common.navigation.resourcesHub, icon: BookOpen },
        { href: "/resources/api", label: common.navigation.apiDocs, icon: Code }
      ]
    }
  ]

  const handleSignOut = async () => {
    // 暂时移除 next-auth 登出功能
    console.log("Sign out functionality temporarily disabled")
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center">
        {/* 左侧：Logo */}
        <div className="flex-shrink-0">
          <LogoVariants.Navigation />
        </div>
        
        {/* 中间：桌面端导航菜单 - 居中显示 */}
        <nav className="hidden md:flex items-center justify-center flex-1 space-x-8">
          {navLinks.map((link) => (
            <div key={link.href} className="relative">
              {link.hasDropdown ? (
                // Resources下拉菜单
                <div className="relative resources-dropdown">
                  <button
                    onClick={() => setIsResourcesMenuOpen(!isResourcesMenuOpen)}
                    className={`flex items-center space-x-1 relative transition-all duration-200 hover:font-semibold active:scale-95 ${
                      pathname.startsWith('/resources') 
                        ? 'text-primary font-semibold' 
                        : 'text-foreground hover:text-primary'
                    }`}
                  >
                    <span>{link.label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isResourcesMenuOpen ? 'rotate-180' : ''}`} />
                    {pathname.startsWith('/resources') && (
                      <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                  
                  {/* Resources下拉菜单内容 */}
                  {isResourcesMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-background border border-border rounded-lg shadow-lg py-2 z-[9999]">
                      {link.subItems?.map((subItem) => (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className="flex items-center space-x-3 px-4 py-2 text-sm transition-colors hover:bg-accent"
                          onClick={() => setIsResourcesMenuOpen(false)}
                        >
                          <subItem.icon className="w-4 h-4 text-primary" />
                          <span>{subItem.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // 普通导航链接
                <Link 
                  href={link.href} 
                  className={`relative transition-all duration-200 hover:font-semibold active:scale-95 ${
                    pathname === link.href 
                      ? 'text-primary font-semibold' 
                      : 'text-foreground hover:text-primary'
                  }`}
                >
                  {link.label}
                  {pathname === link.href && (
                    <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* 右侧：桌面端用户状态和按钮 */}
        <div className="hidden md:flex items-center space-x-4 flex-shrink-0">
          {/* 暂时显示未登录状态 */}
          <Link href="/auth/signin">
            <Button 
              variant="ghost" 
              size="sm" 
              className="hover:font-semibold active:scale-95 transition-all duration-200"
            >
              {common.navigation.login}
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button 
              size="sm" 
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              {common.buttons.signUp}
            </Button>
          </Link>
        </div>

        {/* 移动端汉堡菜单按钮 */}
        <div className="md:hidden flex-shrink-0">
          <button
            className="p-2 hover:bg-accent rounded-md active:scale-95 transition-all duration-200"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            <div className="w-6 h-6 flex flex-col justify-center items-center">
              <span className={`block w-5 h-0.5 bg-foreground transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-1' : ''}`} />
              <span className={`block w-5 h-0.5 bg-foreground transition-all duration-300 mt-1 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-foreground transition-all duration-300 mt-1 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* 移动端菜单 */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-lg">
          <div className="container mx-auto px-4 py-4 space-y-4">
            {/* 移动端导航链接 */}
            <nav className="space-y-2">
              {navLinks.map((link) => (
                <div key={link.href}>
                  {link.hasDropdown ? (
                    // Resources下拉菜单
                    <div className="space-y-2">
                      <button
                        onClick={() => setIsResourcesMenuOpen(!isResourcesMenuOpen)}
                        className={`flex items-center justify-between w-full p-3 text-left transition-colors hover:bg-accent rounded-lg ${
                          pathname.startsWith('/resources') 
                            ? 'text-primary font-semibold bg-accent' 
                            : 'text-foreground'
                        }`}
                      >
                        <span>{link.label}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isResourcesMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {/* Resources下拉菜单内容 */}
                      {isResourcesMenuOpen && (
                        <div className="ml-4 space-y-1">
                          {link.subItems?.map((subItem) => (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className="flex items-center space-x-3 p-3 text-sm transition-colors hover:bg-accent rounded-lg"
                              onClick={() => {
                                setIsResourcesMenuOpen(false)
                                setIsMobileMenuOpen(false)
                              }}
                            >
                              <subItem.icon className="w-4 h-4 text-primary" />
                              <span>{subItem.label}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // 普通导航链接
                    <Link 
                      href={link.href} 
                      className={`block p-3 transition-colors hover:bg-accent rounded-lg ${
                        pathname === link.href 
                          ? 'text-primary font-semibold bg-accent' 
                          : 'text-foreground'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}
            </nav>

            {/* 移动端用户状态 */}
            <hr className="border-border" />
            <div className="space-y-2">
              <Link href="/auth/signin">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start hover:font-semibold active:scale-95 transition-all duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {common.navigation.login}
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button 
                  size="sm" 
                  className="w-full justify-start bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {common.buttons.signUp}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
} 