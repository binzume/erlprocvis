# Erlang process visualizer

ErlangのプロセスをWebGLで表示するWebアプリ(と，RubyでErlangノードと通信するためのモジュール)です．

RubyからErlangのノードに[Distribution Protocol](http://www.erlang.org/doc/apps/erts/erl_dist_protocol.html)で接続してRPCしたりします．
プロトコルの勉強ついでに作ったやつなので実用性は皆無です．

![procvis](procvis.png)


- Distribution Protocol http://www.erlang.org/doc/apps/erts/erl_dist_protocol.html
- External Term Format http://www.erlang.org/doc/apps/erts/erl_ext_dist.html
- http://www.erlang.org/doc/man/erlang.html#process_info-2

## Usage

1. gem install sinatra sinatra-contrib
2. 適当なErlangアプリケーションを分散モードで起動
3. rackup
4. ブラウザで開く

## Usage2

``` cmd
irb
irb(main):001:0> require_relative 'erlang'
=> true
irb(main):002:0> erl = Erlang::Erl.new('rubynode@test', File.read(ENV['HOME']+"/.erlang.cookie"))
=> ...
irb(main):003:0> erl.nodes
=> ["node1"]
irb(main):004:0> erl.rpc_call(erl.nodes[0], :io, :format, ["Hello!\n"])
=> :ok
irb(main):005:0> erl.eval(erl.nodes[0], "1 + 1.")
=> 2
```

