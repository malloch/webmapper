from distutils.core import setup


import sys
if 'py2exe' in sys.argv: import py2exe
if 'py2app' in sys.argv: import py2app

data_files = [('',['js']),
              ('',['includes']),
              ('',['css']),
              ('',['images']),
              ('',['html'])
              ]

options = {'argv_emulation': True, 'iconfile': 'images/libmpr.icns'}

setup(name='WebMpr',
      version='0.2',
      description='GUI for libmpr OSC network',
      author='Stephen Sinclair, Aaron Krajeski & Jonathan Wilansky',
      author_email='aaron.krajeski@music.mcgill.ca',
      url='http://libmapper.org',
      data_files = data_files,
      options={'py2app': options},
      windows=['webmpr.py'],
      app=['webmpr.py'],
     )
