# Erlang process visualizer

ErlangのプロセスをWebGLで表示するWebアプリです．

RubyからErlangのノードに[Distribution Protocol](http://www.erlang.org/doc/apps/erts/erl_dist_protocol.html)で接続してRPCしたりします．
プロトコルの勉強ついでに作ったやつなので実用性は皆無です．

![procvis](procvis.png)


- Distribution Protocol http://www.erlang.org/doc/apps/erts/erl_dist_protocol.html
- External Term Format http://www.erlang.org/doc/apps/erts/erl_ext_dist.html

## Usage

1. gem install sinatra sinatra-contrib
2. 適当なErlangアプリケーションを分散モードで起動
3. rackup
4. ブラウザで開く

